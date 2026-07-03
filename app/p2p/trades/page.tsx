"use client";

import { useEffect, useState } from "react";
import { MessageSquare, ArrowLeft, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface Trade {
  id: string;
  type: "buy" | "sell";
  crypto: string;
  fiatAmount: number;
  cryptoAmount: number;
  status: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  awaiting_payment: { label: "En attente de paiement", color: "text-yellow-500 bg-yellow-500/10" },
  paid: { label: "Paiement confirmé", color: "text-blue-500 bg-blue-500/10" },
  completed: { label: "Complétée", color: "text-success bg-success/10" },
  cancelled: { label: "Annulée", color: "text-danger bg-danger/10" },
};

export default function TradesPage() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrades = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Trade[]>("/p2p/trades");
      setTrades(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchTrades();
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
              <h1 className="text-3xl font-bold">Mes transactions</h1>
              <p className="text-text-secondary mt-1 text-sm">
                Suis l&apos;état de tes achats et ventes P2P
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          ) : trades.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-12 text-center">
              <MessageSquare size={40} className="mx-auto text-text-muted mb-3" />
              <p className="text-text-muted mb-2">Aucune transaction pour le moment</p>
              <Link href="/p2p" className="text-primary hover:underline text-sm">
                Voir les annonces disponibles
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {trades.map((trade) => {
                const st = STATUS_LABELS[trade.status] || { label: trade.status, color: "text-text-muted bg-surface-light" };
                return (
                  <Link key={trade.id} href={`/p2p/trades/${trade.id}`}>
                    <div className="rounded-xl border border-border bg-surface/50 hover:bg-surface transition-colors p-4 cursor-pointer">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                            {st.label}
                          </span>
                          <span className="text-xs text-text-muted font-mono">{trade.id}</span>
                        </div>
                        <span className={`text-sm font-semibold ${trade.type === "sell" ? "text-danger" : "text-success"}`}>
                          {trade.type === "sell" ? "Achat" : "Vente"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold">{trade.crypto}</span>
                          <span className="text-text-muted mx-1">•</span>
                          <span className="font-mono font-bold">{trade.fiatAmount.toLocaleString()} CDF</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-text-muted">
                          <Clock size={12} />
                          {new Date(trade.createdAt).toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
