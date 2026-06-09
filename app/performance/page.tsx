"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface SignalStats {
  total: number;
  wins: number;
  losses: number;
  timeouts: number;
  winRate: number;
  roi: number;
  profitFactor: number;
}

interface Signal {
  id: string;
  label: string;
  direction: string;
  signal: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  probability: number;
  result: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
}

export default function PerformancePage() {
  const [stats, setStats] = useState<SignalStats | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"stats" | "history">("stats");

  useEffect(() => {
    Promise.all([
      fetch("/api/signals/stats").then((r) => r.json()),
      fetch("/api/signals/recent?limit=50").then((r) => r.json()),
    ]).then(([s, sigs]) => {
      setStats(s);
      setSignals(Array.isArray(sigs) ? sigs : []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-950 text-white pt-20 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">📊 Performance des Signaux</h1>
          <p className="text-gray-400 mb-8">
            Track record public et transparent de tous les signaux générés par KongoPay.
          </p>

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setTab("stats")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "stats" ? "bg-cyan-500 text-black" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
            >
              Statistiques
            </button>
            <button
              onClick={() => setTab("history")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "history" ? "bg-cyan-500 text-black" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
            >
              Historique ({signals.length})
            </button>
          </div>

          {tab === "stats" && stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="Total Signaux" value={stats.total} color="text-white" />
              <StatCard label="Gagnés" value={stats.wins} color="text-green-400" />
              <StatCard label="Perdus" value={stats.losses} color="text-red-400" />
              <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} color={stats.winRate > 60 ? "text-green-400" : "text-yellow-400"} />
              <StatCard label="ROI" value={`${stats.roi.toFixed(1)}%`} color={stats.roi > 0 ? "text-green-400" : "text-red-400"} />
              <StatCard label="Profit Factor" value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)} color={stats.profitFactor > 1.5 ? "text-green-400" : "text-yellow-400"} />
              <StatCard label="Temps morts" value={stats.timeouts} color="text-gray-400" />
              <StatCard label="Précision" value={stats.total > 0 ? `${(stats.wins / stats.total * 100).toFixed(1)}%` : "N/A"} color="text-cyan-400" />
            </div>
          )}

          {tab === "history" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="text-left py-3 px-2">ID</th>
                    <th className="text-left py-3 px-2">Marché</th>
                    <th className="text-left py-3 px-2">Direction</th>
                    <th className="text-right py-3 px-2">Entrée</th>
                    <th className="text-right py-3 px-2">Prob.</th>
                    <th className="text-right py-3 px-2">Résultat</th>
                    <th className="text-right py-3 px-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map((sig) => {
                    const isWin = sig.result === "win";
                    const isLoss = sig.result === "loss";
                    const isActive = sig.status === "active";
                    return (
                      <tr key={sig.id} className="border-b border-gray-800/50 hover:bg-gray-900/50 transition">
                        <td className="py-3 px-2 font-mono text-xs text-gray-500">{sig.id}</td>
                        <td className="py-3 px-2">{sig.label}</td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${sig.direction === "up" ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>
                            {sig.direction === "up" ? "🟢 Achat" : "🔴 Vente"}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right font-mono">{sig.entryPrice?.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right">{sig.probability}%</td>
                        <td className="py-3 px-2 text-right">
                          {isActive ? (
                            <span className="text-yellow-400 text-xs font-medium">ACTIF</span>
                          ) : isWin ? (
                            <span className="text-green-400 font-medium">✅ Gagné</span>
                          ) : isLoss ? (
                            <span className="text-red-400 font-medium">❌ Perdu</span>
                          ) : (
                            <span className="text-gray-500">{sig.result}</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-500 text-xs">
                          {new Date(sig.createdAt).toLocaleDateString("fr-FR")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {signals.length === 0 && (
                <p className="text-center text-gray-500 py-8">Aucun signal pour le moment.</p>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
