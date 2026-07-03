"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Send, Loader2, ShoppingCart } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface Chat {
  id: string;
  offerId: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  offerType: "buy" | "sell";
  offerCrypto: string;
  offerPricePerUnit: number;
  offerMinAmount: number;
  offerMaxAmount: number;
  offerPaymentMethod: string;
  status: string;
}

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: "text" | "system";
  createdAt: string;
}

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [amount, setAmount] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!id || !user) return;
    const fetchChat = async () => {
      try {
        const chatData = await apiFetch<Chat>(`/p2p/chats/${id}`);
        setChat(chatData);
        const msgs = await apiFetch<Message[]>(`/p2p/chats/${id}/messages`);
        setMessages(msgs);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchChat();
    const interval = setInterval(async () => {
      try {
        const msgs = await apiFetch<Message[]>(`/p2p/chats/${id}/messages`);
        setMessages(msgs);
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [id, user]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      await apiFetch(`/p2p/chats/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: newMessage.trim() }),
      });
      setNewMessage("");
      const msgs = await apiFetch<Message[]>(`/p2p/chats/${id}/messages`);
      setMessages(msgs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handlePlaceOrder = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError("Montant invalide");
      return;
    }
    if (!chat) return;
    if (amt < chat.offerMinAmount || amt > chat.offerMaxAmount) {
      setError(`Montant doit être entre ${chat.offerMinAmount.toLocaleString()} et ${chat.offerMaxAmount.toLocaleString()} CDF`);
      return;
    }
    setPlacingOrder(true);
    setError("");
    try {
      const result = await apiFetch<any>(`/p2p/chats/${id}/place-order`, {
        method: "POST",
        body: JSON.stringify({ amount: amt }),
      });
      if (result.trade?.id) {
        router.push(`/p2p/trades/${result.trade.id}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPlacingOrder(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <main className="pt-24 min-h-screen flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-primary" />
        </main>
        <Footer />
      </>
    );
  }

  if (error && !chat) {
    return (
      <>
        <Header />
        <main className="pt-24 min-h-screen">
          <div className="max-w-3xl mx-auto px-4 py-16">
            <Link href="/p2p" className="flex items-center gap-2 text-text-secondary hover:text-text mb-6">
              <ArrowLeft size={18} /> Retour
            </Link>
            <p className="text-danger">{error}</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const isBuyer = chat && user?.uid === chat.buyerId;
  const isOrdered = chat?.status === "ordered";

  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen pb-24">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link href="/p2p" className="flex items-center gap-2 text-text-secondary hover:text-text mb-4 text-sm">
            <ArrowLeft size={16} /> Retour aux annonces
          </Link>

          {chat && (
            <div className="rounded-xl border border-border bg-surface p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <h1 className="font-bold">
                  {chat.offerType === "sell" ? "Achat" : "Vente"} {chat.offerCrypto}
                </h1>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  chat.status === "open" ? "bg-success/20 text-success" : "bg-text-muted/20 text-text-muted"
                }`}>
                  {chat.status === "open" ? "En discussion" : "Commande passée"}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-text-secondary">
                <span>Prix: <strong>{chat.offerPricePerUnit.toLocaleString()} CDF</strong></span>
                <span>Min: {chat.offerMinAmount.toLocaleString()} CDF</span>
                <span>Max: {chat.offerMaxAmount.toLocaleString()} CDF</span>
                <span>{chat.offerPaymentMethod}</span>
              </div>
            </div>
          )}

          {error && chat && (
            <div className="mb-4 p-3 rounded-lg border border-danger/30 bg-danger/10 text-danger text-xs">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-border bg-surface">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold">Discussion</h2>
            </div>
            <div className="h-80 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.type === "system" ? "justify-center" : msg.senderId === user?.uid ? "justify-end" : "justify-start"}`}>
                  {msg.type === "system" ? (
                    <div className="bg-background rounded-lg px-4 py-2 text-xs text-text-muted text-center max-w-md">
                      {msg.content}
                    </div>
                  ) : (
                    <div className={`max-w-[75%] ${msg.senderId === user?.uid ? "bg-primary text-white" : "bg-background text-text"} rounded-lg px-4 py-2`}>
                      <p className="text-xs opacity-70 mb-0.5">{msg.senderName}</p>
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSend} className="p-4 border-t border-border flex gap-2">
              <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-primary"
                placeholder="Écris un message..." />
              <button type="submit" disabled={sending || !newMessage.trim()}
                className="p-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50">
                <Send size={16} />
              </button>
            </form>
          </div>

          {isBuyer && !isOrdered && (
            <div className="mt-6 rounded-xl border border-border bg-surface p-5">
              <h3 className="font-semibold mb-3">Passer la commande</h3>
              <p className="text-xs text-text-secondary mb-3">
                Une fois d&apos;accord avec l&apos;annonceur, saisis le montant et passe commande.
              </p>
              <div className="flex items-center gap-2">
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Montant (CDF)`}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-text outline-none focus:border-primary" />
                <button onClick={handlePlaceOrder} disabled={placingOrder}
                  className="px-5 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5 text-sm">
                  {placingOrder ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                  Commander
                </button>
              </div>
            </div>
          )}

          {isOrdered && (
            <div className="mt-6 rounded-xl border border-success/30 bg-success/5 p-4 text-center">
              <p className="text-sm font-medium text-success">Commande passée !</p>
              <Link href="/p2p/trades" className="text-primary hover:underline text-xs mt-1 inline-block">
                Voir mes transactions
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
