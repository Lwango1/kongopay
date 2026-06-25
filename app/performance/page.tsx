"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getSignalStats, getRecentSignals } from "@/lib/signalStore";
import type { SignalRecord } from "@/lib/signalStore";

export default function PerformancePage() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getSignalStats>> | null>(null);
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"stats" | "history" | "risk">("stats");

  useEffect(() => {
    const load = async () => {
      try {
        const [s, sigs] = await Promise.all([
          getSignalStats(),
          getRecentSignals(100),
        ]);
        setStats(s);
        setSignals(sigs);
      } catch {}
      setLoading(false);
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const activeSignals = signals.filter(s => s.result === "active");
  const closedSignals = signals.filter(s => s.result && s.result !== "active");
  const activeCount = activeSignals.length;

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
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold">Performance des Signaux</h1>
            {activeCount > 0 && (
              <span className="text-sm px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                {activeCount} signal{activeCount > 1 ? "x" : ""} actif{activeCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-gray-400 mb-8">
            Track record basé sur {stats?.total ?? 0} signaux real tracks.
          </p>

          <div className="flex gap-2 mb-6 flex-wrap">
            <TabBtn label="Statistiques" tab="stats" current={tab} onClick={setTab} />
            <TabBtn label={`Historique (${closedSignals.length})`} tab="history" current={tab} onClick={setTab} />
            <TabBtn label="Risk Management" tab="risk" current={tab} onClick={setTab} />
          </div>

          {tab === "stats" && stats && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard label="Total Signaux" value={stats.total} />
                <StatCard label="Gagnés" value={stats.wins} color="text-green-400" />
                <StatCard label="Perdus" value={stats.losses} color="text-red-400" />
                <StatCard label="Win Rate" value={stats.total > 0 ? `${stats.winRate.toFixed(1)}%` : "—"} color={stats.winRate >= 60 ? "text-green-400" : stats.winRate >= 40 ? "text-yellow-400" : "text-red-400"} />
                <StatCard label="ROI" value={stats.total > 0 ? `${stats.roi.toFixed(1)}%` : "—"} color={stats.roi > 0 ? "text-green-400" : "text-red-400"} />
                <StatCard label="Profit Factor" value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)} color={stats.profitFactor >= 1.5 ? "text-green-400" : stats.profitFactor >= 1 ? "text-yellow-400" : "text-red-400"} />
                <StatCard label="Temps morts" value={stats.timeouts} />
                <StatCard label="Précision" value={stats.total > 0 ? `${(stats.wins / stats.total * 100).toFixed(1)}%` : "—"} color="text-cyan-400" />
              </div>

              {/* Performance par marché */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
                <h2 className="text-lg font-semibold mb-4">Performance par marché</h2>
                {Object.keys(stats.byMarket).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(stats.byMarket)
                      .sort(([, a], [, b]) => b.winRate - a.winRate)
                      .map(([key, m]) => {
                        const label = key.replace("_", " ");
                        const color = m.winRate >= 70 ? "text-green-400" : m.winRate >= 50 ? "text-yellow-400" : "text-red-400";
                        return (
                          <div key={key} className="flex items-center gap-4">
                            <span className="text-sm font-medium w-28">{label}</span>
                            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${m.winRate}%`, background: m.winRate >= 70 ? "#22c55e" : m.winRate >= 50 ? "#eab308" : "#ef4444" }} />
                            </div>
                            <span className={`text-sm font-bold font-mono w-20 text-right ${color}`}>{m.winRate.toFixed(0)}%</span>
                            <span className="text-xs text-gray-500 w-24 text-right">{m.wins}/{m.total}</span>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Aucun signal résolu pour le moment.</p>
                )}
              </div>
            </>
          )}

          {tab === "history" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="text-left py-3 px-2">Marché</th>
                    <th className="text-left py-3 px-2">Direction</th>
                    <th className="text-right py-3 px-2">Proba</th>
                    <th className="text-right py-3 px-2">Entrée</th>
                    <th className="text-right py-3 px-2">SL</th>
                    <th className="text-right py-3 px-2">TP</th>
                    <th className="text-right py-3 px-2">Résultat</th>
                    <th className="text-right py-3 px-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {closedSignals.map((sig) => {
                    const isWin = sig.result === "win";
                    const isLoss = sig.result === "loss";
                    const isTimeout = sig.result === "timeout";
                    return (
                      <tr key={sig.id} className="border-b border-gray-800/50 hover:bg-gray-900/50 transition">
                        <td className="py-3 px-2 font-medium">{sig.label}</td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${sig.direction === "up" ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>
                            {sig.direction === "up" ? "Achat" : "Vente"}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right font-mono">{sig.probability}%</td>
                        <td className="py-3 px-2 text-right font-mono">{sig.entryPrice?.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right font-mono text-red-400">{sig.stopLoss?.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right font-mono text-green-400">{sig.takeProfit?.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right">
                          {isWin ? (
                            <span className="text-green-400 font-medium">Gagné</span>
                          ) : isLoss ? (
                            <span className="text-red-400 font-medium">Perdu</span>
                          ) : isTimeout ? (
                            <span className="text-yellow-400 text-xs font-medium">Timeout</span>
                          ) : (
                            <span className="text-yellow-400 text-xs font-medium animate-pulse">ACTIF</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-500 text-xs">
                          {new Date(sig.detectedAt).toLocaleDateString("fr-FR")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {closedSignals.length === 0 && (
                <p className="text-center text-gray-500 py-8">Aucun signal résolu pour le moment.</p>
              )}
            </div>
          )}

          {tab === "risk" && (
            <>
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <StatCard label="Total Trades" value={stats.total} />
                  <StatCard label="Win Rate" value={stats.total > 0 ? `${stats.winRate.toFixed(1)}%` : "—"} color={stats.winRate >= 60 ? "text-green-400" : "text-yellow-400"} />
                  <StatCard label="Profit Factor" value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)} color={stats.profitFactor >= 1.5 ? "text-green-400" : "text-yellow-400"} />
                  <StatCard label="Kelly Sizing" value={stats.total > 10 ? `${(stats.winRate / 100 * (1 - stats.winRate / 100) * 0.5 * 100).toFixed(1)}%` : "N/A"} />
                </div>
              )}

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
                <h2 className="text-lg font-semibold mb-4">État du Risk Manager</h2>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-gray-400">Drawdown Control</p>
                    <p className="text-green-400 font-bold">Actif</p>
                    <p className="text-xs text-gray-500">Stop à -20%</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-gray-400">Kelly Criterion</p>
                    <p className={stats && stats.total > 10 ? "text-cyan-400 font-bold" : "text-gray-500 font-bold"}>
                      {stats && stats.total > 10 ? "Actif" : `En attente (${10 - (stats?.total ?? 0)}+ trades)`}
                    </p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-gray-400">Correlation Filter</p>
                    <p className="text-cyan-400 font-bold">Actif</p>
                    <p className="text-xs text-gray-500">Évite les signaux opposés</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function StatCard({ label, value, color = "text-white" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function TabBtn({ label, tab, current, onClick }: { label: string; tab: string; current: string; onClick: (t: any) => void }) {
  return (
    <button onClick={() => onClick(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${current === tab ? "bg-cyan-500 text-black" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>
      {label}
    </button>
  );
}
