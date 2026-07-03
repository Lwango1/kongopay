"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Send, CheckCircle, XCircle, Loader2, AlertCircle, Copy } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface Trade {
  id: string;
  offerId: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  type: "buy" | "sell";
  crypto: string;
  fiatAmount: number;
  cryptoAmount: number;
  pricePerUnit: number;
  paymentMethod: string;
  status: string;
  transactionId: string | null;
  buyerPaymentMethod: string | null;
  createdAt: string;
}

interface Message {
  id: string;
  tradeId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: "text" | "system";
  createdAt: string;
}

interface PaymentDetails {
  airtelMoney: string;
  orangeMoney: string;
  mpesa: string;
  binanceWallet: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  awaiting_payment: { label: "En attente de paiement", color: "text-yellow-500 border-yellow-500/30 bg-yellow-500/10" },
  paid: { label: "Paiement confirmé", color: "text-blue-500 border-blue-500/30 bg-blue-500/10" },
  completed: { label: "Complétée", color: "text-green-500 border-green-500/30 bg-green-500/10" },
  cancelled: { label: "Annulée", color: "text-red-500 border-red-500/30 bg-red-500/10" },
};

export default function TradeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Airtel Money");
  const [confirming, setConfirming] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [copied, setCopied] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAdmin = trade && user?.uid === trade.sellerId;
  const isBuyer = trade && user?.uid === trade.buyerId;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!id || !user) return;
    const fetchData = async () => {
      try {
        const [tradeData, messagesData, paymentData] = await Promise.all([
          apiFetch<Trade>(`/p2p/trades/${id}`),
          apiFetch<Message[]>(`/p2p/trades/${id}/messages`),
          apiFetch<PaymentDetails>("/p2p/payment-details"),
        ]);
        setTrade(tradeData);
        setMessages(messagesData);
        setPaymentDetails(paymentData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(async () => {
      try {
        const messagesData = await apiFetch<Message[]>(`/p2p/trades/${id}/messages`);
        const tradeData = await apiFetch<Trade>(`/p2p/trades/${id}`);
        setMessages(messagesData);
        setTrade(tradeData);
      } catch { /* ignore */ }
    }, 4000);
    return () => clearInterval(interval);
  }, [id, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      await apiFetch(`/p2p/trades/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: newMessage.trim() }),
      });
      setNewMessage("");
      const messagesData = await apiFetch<Message[]>(`/p2p/trades/${id}/messages`);
      setMessages(messagesData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionId.trim() || confirming) return;
    setConfirming(true);
    try {
      await apiFetch(`/p2p/trades/${id}/confirm-payment`, {
        method: "POST",
        body: JSON.stringify({ transactionId: transactionId.trim(), paymentMethod }),
      });
      setTransactionId("");
      setShowPaymentForm(false);
      const [tradeData, messagesData] = await Promise.all([
        apiFetch<Trade>(`/p2p/trades/${id}`),
        apiFetch<Message[]>(`/p2p/trades/${id}/messages`),
      ]);
      setTrade(tradeData);
      setMessages(messagesData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConfirming(false);
    }
  };

  const handleRelease = async () => {
    try {
      await apiFetch(`/p2p/trades/${id}/release`, { method: "POST" });
      const [tradeData, messagesData] = await Promise.all([
        apiFetch<Trade>(`/p2p/trades/${id}`),
        apiFetch<Message[]>(`/p2p/trades/${id}/messages`),
      ]);
      setTrade(tradeData);
      setMessages(messagesData);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Annuler cette transaction ?")) return;
    try {
      await apiFetch(`/p2p/trades/${id}/cancel`, { method: "POST" });
      const [tradeData, messagesData] = await Promise.all([
        apiFetch<Trade>(`/p2p/trades/${id}`),
        apiFetch<Message[]>(`/p2p/trades/${id}/messages`),
      ]);
      setTrade(tradeData);
      setMessages(messagesData);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
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

  if (error || !trade) {
    return (
      <>
        <Header />
        <main className="pt-24 min-h-screen">
          <div className="max-w-3xl mx-auto px-4 py-16">
            <Link href="/p2p/trades" className="flex items-center gap-2 text-text-secondary hover:text-text mb-6">
              <ArrowLeft size={18} /> Retour
            </Link>
            <div className="rounded-xl border border-danger/30 bg-danger/10 p-6 text-center">
              <AlertCircle size={32} className="mx-auto text-danger mb-2" />
              <p className="text-danger">{error || "Transaction introuvable"}</p>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const st = STATUS_LABELS[trade.status] || { label: trade.status, color: "text-text-muted" };

  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen pb-24">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link href="/p2p/trades" className="flex items-center gap-2 text-text-secondary hover:text-text mb-4 text-sm">
            <ArrowLeft size={16} /> Mes transactions
          </Link>

          <div className="rounded-xl border border-border bg-surface p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold">Transaction {trade.id}</h1>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${st.color}`}>
                  {st.label}
                </span>
              </div>
              {isBuyer && ["awaiting_payment", "pending"].includes(trade.status) && (
                <button onClick={handleCancel} className="text-xs text-danger hover:underline">
                  Annuler
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-text-muted text-xs">Type</p>
                <p className={`font-semibold ${trade.type === "sell" ? "text-danger" : "text-success"}`}>
                  {trade.type === "sell" ? "Achat" : "Vente"}
                </p>
              </div>
              <div>
                <p className="text-text-muted text-xs">Crypto</p>
                <p className="font-semibold">{trade.crypto}</p>
              </div>
              <div>
                <p className="text-text-muted text-xs">Montant</p>
                <p className="font-mono font-bold">{trade.fiatAmount.toLocaleString()} CDF</p>
              </div>
              <div>
                <p className="text-text-muted text-xs">Quantité</p>
                <p className="font-mono">{trade.cryptoAmount.toFixed(6)} {trade.crypto}</p>
              </div>
              <div>
                <p className="text-text-muted text-xs">Prix unitaire</p>
                <p className="font-mono">{trade.pricePerUnit.toLocaleString()} CDF</p>
              </div>
              <div>
                <p className="text-text-muted text-xs">Paiement</p>
                <p>{trade.paymentMethod}</p>
              </div>
              {trade.transactionId && (
                <div className="col-span-2">
                  <p className="text-text-muted text-xs">ID Transaction</p>
                  <p className="font-mono text-xs">{trade.transactionId}</p>
                </div>
              )}
            </div>
          </div>

          {trade.status === "awaiting_payment" && isBuyer && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 mb-6">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle size={20} className="text-yellow-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-sm mb-2">Instructions de paiement</h3>
                  <p className="text-sm text-text-secondary mb-3">
                    {trade.type === "sell"
                      ? `Envoie ${trade.fiatAmount.toLocaleString()} CDF à l\'administrateur via l\'un des moyens ci-dessous, puis confirme le paiement avec l\'ID de transaction.`
                      : `Envoie ${trade.cryptoAmount.toFixed(6)} ${trade.crypto} à l\'adresse Binance de l\'administrateur ci-dessous, puis confirme avec l\'ID de transaction.`}
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {trade.type === "sell" ? (
                  <>
                    <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2 text-sm">
                      <span className="text-text-muted">Airtel Money</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{paymentDetails?.airtelMoney || "..."}</span>
                        <button onClick={() => copyToClipboard(paymentDetails?.airtelMoney || "", "airtel")} className="p-1 hover:bg-surface-light rounded">
                          <Copy size={14} className="text-text-muted" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2 text-sm">
                      <span className="text-text-muted">Orange Money</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{paymentDetails?.orangeMoney || "..."}</span>
                        <button onClick={() => copyToClipboard(paymentDetails?.orangeMoney || "", "orange")} className="p-1 hover:bg-surface-light rounded">
                          <Copy size={14} className="text-text-muted" />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2 text-sm">
                    <span className="text-text-muted">Adresse Binance</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs truncate max-w-[200px]">{paymentDetails?.binanceWallet || "..."}</span>
                      <button onClick={() => copyToClipboard(paymentDetails?.binanceWallet || "", "binance")} className="p-1 hover:bg-surface-light rounded">
                        <Copy size={14} className="text-text-muted" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {showPaymentForm ? (
                <form onSubmit={handleConfirmPayment} className="space-y-3">
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Moyen de paiement utilisé</label>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-primary">
                      <option value="Airtel Money">Airtel Money</option>
                      <option value="Orange Money">Orange Money</option>
                      <option value="M-Pesa">M-Pesa</option>
                      <option value="Binance Wallet">Binance Wallet</option>
                      <option value="Virement bancaire">Virement bancaire</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">ID de transaction</label>
                    <input type="text" value={transactionId} onChange={(e) => setTransactionId(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-text outline-none focus:border-primary"
                      placeholder="Ex: BCX12345 ou TXID..." required />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowPaymentForm(false)}
                      className="flex-1 py-2 rounded-lg border border-border text-text-secondary hover:bg-surface transition-colors text-sm">
                      Annuler
                    </button>
                    <button type="submit" disabled={confirming}
                      className="flex-1 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors text-sm disabled:opacity-50">
                      {confirming ? "Confirmation..." : "Confirmer le paiement"}
                    </button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setShowPaymentForm(true)}
                  className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors text-sm">
                  J&apos;ai effectué le paiement
                </button>
              )}
            </div>
          )}

          {trade.status === "paid" && isAdmin && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-5 mb-6">
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle size={20} className="text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-sm mb-1">Paiement confirmé par l&apos;acheteur</h3>
                  <p className="text-sm text-text-secondary">
                    ID Transaction: <span className="font-mono">{trade.transactionId}</span>
                    {trade.buyerPaymentMethod && <> via {trade.buyerPaymentMethod}</>}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleRelease}
                  className="flex-1 py-2.5 rounded-lg bg-success text-white font-semibold hover:bg-success/90 transition-colors text-sm">
                  Libérer les fonds
                </button>
                <button onClick={handleCancel}
                  className="flex-1 py-2.5 rounded-lg border border-danger/30 text-danger hover:bg-danger/10 transition-colors text-sm">
                  Signaler un problème
                </button>
              </div>
            </div>
          )}

          {trade.status === "completed" && (
            <div className="rounded-xl border border-success/30 bg-success/5 p-5 mb-6">
              <div className="flex items-center gap-3">
                <CheckCircle size={20} className="text-success" />
                <p className="text-sm font-medium">Transaction complétée avec succès</p>
              </div>
            </div>
          )}

          {trade.status === "cancelled" && (
            <div className="rounded-xl border border-danger/30 bg-danger/5 p-5 mb-6">
              <div className="flex items-center gap-3">
                <XCircle size={20} className="text-danger" />
                <p className="text-sm font-medium">Transaction annulée</p>
              </div>
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
            {!["completed", "cancelled"].includes(trade.status) && (
              <form onSubmit={handleSendMessage} className="p-4 border-t border-border flex gap-2">
                <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-primary"
                  placeholder="Écris un message..." />
                <button type="submit" disabled={sending || !newMessage.trim()}
                  className="p-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50">
                  <Send size={16} />
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
