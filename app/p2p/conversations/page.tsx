"use client";

import { useEffect, useState } from "react";
import { MessageCircle, ArrowLeft, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface Chat {
  id: string;
  offerId: string;
  offerType: "buy" | "sell";
  offerCrypto: string;
  offerPricePerUnit: number;
  status: string;
  createdAt: string;
  lastMessage?: string;
}

export default function ConversationsPage() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchChats = async () => {
      try {
        const data = await apiFetch<Chat[]>("/p2p/chats");
        setChats(data);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    fetchChats();
  }, [user]);

  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen">
        <section className="max-w-3xl mx-auto px-4 py-16">
          <div className="flex items-center gap-3 mb-8">
            <Link href="/p2p" className="p-2 rounded-lg border border-border hover:bg-surface transition-colors">
              <ArrowLeft size={18} className="text-text-muted" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Mes discussions</h1>
              <p className="text-text-secondary mt-1 text-sm">
                Discute avec les annonceurs avant de passer commande
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          ) : chats.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-12 text-center">
              <MessageCircle size={40} className="mx-auto text-text-muted mb-3" />
              <p className="text-text-muted mb-2">Aucune discussion pour le moment</p>
              <Link href="/p2p" className="text-primary hover:underline text-sm">
                Voir les annonces
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {chats.map((chat) => (
                <Link key={chat.id} href={`/p2p/conversations/${chat.id}`}>
                  <div className="rounded-xl border border-border bg-surface/50 hover:bg-surface transition-colors p-4 cursor-pointer">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${chat.offerType === "sell" ? "text-danger" : "text-success"}`}>
                          {chat.offerType === "sell" ? "Achat" : "Vente"} {chat.offerCrypto}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${chat.status === "open" ? "bg-success/20 text-success" : "bg-text-muted/20 text-text-muted"}`}>
                          {chat.status === "open" ? "En cours" : "Commande passée"}
                        </span>
                      </div>
                      <span className="text-xs text-text-muted font-mono">{chat.id}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-muted">
                        {chat.offerPricePerUnit.toLocaleString()} CDF
                      </span>
                      <span className="text-xs text-text-muted">
                        {new Date(chat.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    {chat.lastMessage && (
                      <p className="text-xs text-text-secondary mt-2 truncate">{chat.lastMessage}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
