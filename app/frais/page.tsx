"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { apiFetch } from "@/lib/api";

interface Fees {
  tradingMaker: number;
  tradingTaker: number;
  withdrawalCdf: number;
  withdrawalCrypto: number;
  deposit: number;
}

export default function FraisPage() {
  const [fees, setFees] = useState<Fees | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiFetch<Fees>("/fees");
        setFees(data);
      } catch { /* use defaults */ }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen">
        <section className="max-w-3xl mx-auto px-4 py-16">
          <div className="flex items-center gap-3 mb-2">
            <Info className="text-primary" size={28} />
            <h1 className="text-3xl font-bold">Frais de trading</h1>
          </div>
          <p className="text-text-secondary mb-8">
            Des frais parmi les plus bas du marché pour l&apos;Afrique francophone.
          </p>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-surface-light animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-light/50">
                    <th className="text-left py-3 px-4 font-medium text-text-muted">Type</th>
                    <th className="text-right py-3 px-4 font-medium text-text-muted">Frais</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-3 px-4">
                      <span className="font-medium">Trading Maker</span>
                      <p className="text-xs text-text-muted">Ordre limit qui ajoute de la liquidité</p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-success">{pct(fees?.tradingMaker ?? 0.001)}</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-3 px-4">
                      <span className="font-medium">Trading Taker</span>
                      <p className="text-xs text-text-muted">Ordre market qui prend de la liquidité</p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-success">{pct(fees?.tradingTaker ?? 0.001)}</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-3 px-4">
                      <span className="font-medium">Retrait Mobile Money</span>
                      <p className="text-xs text-text-muted">Retrait vers Airtel/Orange/M-Pesa</p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-warning">{pct(fees?.withdrawalCdf ?? 0.005)}</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-3 px-4">
                      <span className="font-medium">Retrait Crypto</span>
                      <p className="text-xs text-text-muted">Transfert vers wallet externe</p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-warning">{pct(fees?.withdrawalCrypto ?? 0.001)}</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4">
                      <span className="font-medium">Dépôt Mobile Money</span>
                      <p className="text-xs text-text-muted">Dépôt depuis Airtel/Orange/M-Pesa</p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-success">Gratuit</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-8 p-4 rounded-xl border border-border bg-surface/50">
            <h3 className="font-semibold mb-2 text-sm">Pourquoi nos frais sont les plus bas ?</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              KongoPay utilise le smart order routing pour trouver les meilleurs prix sur Binance et d&apos;autres exchanges.
              Nous ne facturons pas de frais cachés et notre modèle économique repose sur le volume.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
