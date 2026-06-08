"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Converter from "@/components/Converter";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

interface Wallet {
  balanceCdf: number;
  balanceUsd: number;
  cryptoBalances: Record<string, number>;
}

interface Transaction {
  id: string;
  type: string;
  amountCdf?: number;
  amountUsd?: number;
  description: string;
  timestamp: string;
  status: string;
}

export default function PortefeuillePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/connexion");
      return;
    }

    const loadWallet = async () => {
      try {
        const [walletData, txData] = await Promise.all([
          apiFetch<Wallet>("/wallet/balance"),
          apiFetch<Transaction[]>("/wallet/transactions"),
        ]);
        setWallet(walletData);
        setTransactions(txData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadWallet();
  }, [user, authLoading, router]);

  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen">
        <section className="max-w-4xl mx-auto px-4 py-16">
          <h1 className="text-4xl font-bold mb-2">Portefeuille</h1>
          <p className="text-text-secondary mb-8">Gérez vos actifs numériques en toute sécurité.</p>

          {error && (
            <div className="mb-6 p-4 rounded-xl border border-danger/30 bg-danger/10 text-danger text-sm">
              {error}
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="text-sm text-text-muted mb-1">Solde total (CDF)</div>
              <div className="text-2xl font-bold">
                {loading ? "..." : `${(wallet?.balanceCdf ?? 0).toLocaleString()} CDF`}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="text-sm text-text-muted mb-1">Solde (USD)</div>
              <div className="text-2xl font-bold">
                {loading ? "..." : `$${(wallet?.balanceUsd ?? 0).toFixed(2)}`}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="text-sm text-text-muted mb-1">Cryptos</div>
              <div className="text-2xl font-bold">
                {loading ? "..." : Object.keys(wallet?.cryptoBalances ?? {}).length}
              </div>
            </div>
          </div>

          {wallet?.cryptoBalances && Object.keys(wallet.cryptoBalances).length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5 mb-8">
              <h2 className="font-semibold mb-4">Actifs Crypto</h2>
              <div className="space-y-3">
                {Object.entries(wallet.cryptoBalances).map(([crypto, amount]) => (
                  <div key={crypto} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="font-medium">{crypto}</span>
                    <span className="font-mono">{amount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {transactions.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5 mb-8">
              <h2 className="font-semibold mb-4">Transactions récentes</h2>
              <div className="space-y-2">
                {transactions.slice(0, 10).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 text-sm border-b border-border last:border-0">
                    <div>
                      <span className="text-text-secondary">{tx.description}</span>
                      <span className="text-xs text-text-muted ml-2">
                        {new Date(tx.timestamp).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    <span className={`font-mono font-medium ${tx.type === "credit" ? "text-success" : "text-danger"}`}>
                      {tx.type === "credit" ? "+" : "-"}{tx.amountCdf?.toLocaleString() ?? ""} CDF
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && !wallet && (
            <div className="rounded-xl border border-border bg-surface p-12 text-center">
              <p className="text-text-muted">Connectez-vous pour voir votre portefeuille.</p>
            </div>
          )}

          <Converter />
        </section>
      </main>
      <Footer />
    </>
  );
}
