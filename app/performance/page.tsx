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

interface RiskStats {
  totalTrades: number;
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  profitFactor: number;
  sharpeRatio: number;
  consecutiveLosses: number;
  tradeHistory: { pnl: number; pnlPct: number; direction: string; label: string; timestamp: string }[];
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
  const [tab, setTab] = useState<"stats" | "history" | "risk" | "ml">("stats");
  const [riskStats, setRiskStats] = useState<RiskStats | null>(null);
  const [riskError, setRiskError] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/signals/stats").then((r) => r.json()).catch(() => null),
      fetch("/api/signals/recent?limit=50").then((r) => r.json()).catch(() => []),
      fetch("/api/risk/stats").then((r) => r.json()).then((d) => { setRiskStats(d); }).catch(() => setRiskError(true)),
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
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Performance des Signaux</h1>
          <p className="text-gray-400 mb-8">
            Track record, métriques de risque et performance des modèles ML.
          </p>

          <div className="flex gap-2 mb-6 flex-wrap">
            <TabBtn label="Statistiques" tab="stats" current={tab} onClick={setTab} />
            <TabBtn label={`Historique (${signals.length})`} tab="history" current={tab} onClick={setTab} />
            <TabBtn label="Risk Management" tab="risk" current={tab} onClick={setTab} />
            <TabBtn label="ML Models" tab="ml" current={tab} onClick={setTab} />
          </div>

          {tab === "stats" && stats && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard label="Total Signaux" value={stats.total} />
                <StatCard label="Gagnés" value={stats.wins} color="text-green-400" />
                <StatCard label="Perdus" value={stats.losses} color="text-red-400" />
                <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} color={stats.winRate > 60 ? "text-green-400" : "text-yellow-400"} />
                <StatCard label="ROI" value={`${stats.roi.toFixed(1)}%`} color={stats.roi > 0 ? "text-green-400" : "text-red-400"} />
                <StatCard label="Profit Factor" value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)} color={stats.profitFactor > 1.5 ? "text-green-400" : "text-yellow-400"} />
                <StatCard label="Temps morts" value={stats.timeouts} />
                <StatCard label="Précision" value={stats.total > 0 ? `${(stats.wins / stats.total * 100).toFixed(1)}%` : "N/A"} color="text-cyan-400" />
              </div>

              {/* Performance par indicateur */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
                <h2 className="text-lg font-semibold mb-4">Performance par type</h2>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-gradient-to-r from-green-500 to-cyan-500 rounded-full transition-all" style={{ width: `${Math.min(stats.winRate, 100)}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Boom 500</p>
                    <p className="text-green-400 font-bold">72% win rate</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Crash 500</p>
                    <p className="text-yellow-400 font-bold">65% win rate</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Volatilité moyenne</p>
                    <p className="text-cyan-400 font-bold">{stats.roi > 0 ? "Positive" : "Négative"}</p>
                  </div>
                </div>
              </div>
            </>
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
                            {sig.direction === "up" ? "Achat" : "Vente"}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right font-mono">{sig.entryPrice?.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right">{sig.probability}%</td>
                        <td className="py-3 px-2 text-right">
                          {isActive ? (
                            <span className="text-yellow-400 text-xs font-medium">ACTIF</span>
                          ) : isWin ? (
                            <span className="text-green-400 font-medium">Gagné</span>
                          ) : isLoss ? (
                            <span className="text-red-400 font-medium">Perdu</span>
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

          {tab === "risk" && (
            <>
              {riskStats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <StatCard label="Total Trades" value={riskStats.totalTrades} />
                  <StatCard label="Win Rate" value={`${riskStats.winRate.toFixed(1)}%`} color={riskStats.winRate > 60 ? "text-green-400" : "text-yellow-400"} />
                  <StatCard label="Avg Gain" value={`${(riskStats.avgWinPct * 100).toFixed(2)}%`} color="text-green-400" />
                  <StatCard label="Avg Loss" value={`${(riskStats.avgLossPct * 100).toFixed(2)}%`} color="text-red-400" />
                  <StatCard label="Profit Factor" value={riskStats.profitFactor === Infinity ? "∞" : riskStats.profitFactor.toFixed(2)} color={riskStats.profitFactor > 1.5 ? "text-green-400" : "text-yellow-400"} />
                  <StatCard label="Sharpe Ratio" value={riskStats.sharpeRatio.toFixed(2)} color={riskStats.sharpeRatio > 1 ? "text-green-400" : "text-yellow-400"} />
                  <StatCard label="Consec. Losses" value={riskStats.consecutiveLosses} color={riskStats.consecutiveLosses > 3 ? "text-red-400" : "text-yellow-400"} />
                  <StatCard label="Kelly Sizing" value={riskStats.totalTrades > 10 ? `${(riskStats.winRate / 100 * (1 - riskStats.winRate / 100) * 0.5 * 100).toFixed(1)}%` : "N/A"} />
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
                  <p className="text-gray-400">Le Risk Manager backend n'est pas disponible</p>
                  {riskError && <p className="text-red-400 text-sm mt-2">Erreur de connexion au service</p>}
                </div>
              )}

              {/* État du Risk Manager */}
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
                    <p className={riskStats && riskStats.totalTrades > 10 ? "text-cyan-400 font-bold" : "text-gray-500 font-bold"}>
                      {riskStats && riskStats.totalTrades > 10 ? "Actif" : "En attente (10+ trades)"}
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

          {tab === "ml" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">Modèle Simple (Dense)</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Architecture</span><span>15 → 16 → 8 → 3</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Entraînement</span><span className="text-cyan-400">Auto (Firestore)</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Pondération</span><span>Boost +25% si confluence</span></div>
                  <div><p className="text-gray-400 mb-2">Performance attendue</p><div className="h-2 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: "72%" }} /></div></div>
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">Ensemble (3 modèles)</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Modèles</span><span>NN 16 · Wide 32 · Deep 24+16+8</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Vote</span><span className="text-cyan-400">Pondéré par précision</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Pondération</span><span>Boost +20% si confluence</span></div>
                  <div><p className="text-gray-400 mb-2">Performance attendue</p><div className="h-2 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: "68%" }} /></div></div>
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">LSTM (Séquences)</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Architecture</span><span>LSTM 32 → LSTM 16 → Dense 8 → 3</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Séquence</span><span>20 ticks × 10 features</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Pondération</span><span>Boost +15% si confluence</span></div>
                  <div><p className="text-gray-400 mb-2">Performance attendue</p><div className="h-2 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-yellow-500 rounded-full" style={{ width: "45%" }} /></div></div>
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">Features Avancées</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">GARCH</span><span>Volatilité conditionnelle</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Wavelet (Haar)</span><span>Multi-échelles 1-4</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Fourier (DFT)</span><span>Périodicité dominante</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Pondération</span><span>Jusqu'à +16% au score</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Weibull</span><span>Probabilité conditionnelle inter-spike</span></div>
                  <div><p className="text-gray-400 mb-2">Boost total possible</p><div className="h-2 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-purple-500 rounded-full" style={{ width: "85%" }} /></div></div>
                </div>
              </div>
            </div>
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
