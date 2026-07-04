"use client";

import { useState, useEffect } from "react";
import { Gauge, TrendingUp, TrendingDown, AlertTriangle, Bell, BellOff, Wifi, WifiOff, Loader2, RefreshCw, ArrowUp, ArrowDown, Flame, Droplet, BarChart3, Newspaper } from "lucide-react";
import { initDerivClient, scanAllMarkets } from "@/lib/deriv";
import type { MarketScanResult, MarketOpportunity } from "@/lib/deriv";
import { saveSignal, checkAndResolveSignals, getSignalStats } from "@/lib/signalStore";
import DerivChart from "@/components/DerivChart";
import NewsTrader from "@/components/NewsTrader";
import AdBanner from "@/components/AdBanner";

const INDICES_CONFIG: Record<string, { color: string; bgColor: string }> = {
  "Boom 500": { color: "#22c55e", bgColor: "rgba(34,197,94,0.1)" },
  "Boom 900": { color: "#16a34a", bgColor: "rgba(22,163,74,0.1)" },
  "Boom 1000": { color: "#15803d", bgColor: "rgba(21,128,61,0.1)" },
  "Crash 500": { color: "#fb7185", bgColor: "rgba(251,113,133,0.1)" },
  "Crash 900": { color: "#f43f5e", bgColor: "rgba(244,63,94,0.1)" },
  "Crash 1000": { color: "#be123c", bgColor: "rgba(190,18,60,0.1)" },
};

const SIGNAL_EXPIRY_MS = 5 * 60 * 1000;

function sendBrowserNotification(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/icon.png", tag: "signal", requireInteraction: true });
  } catch {}
}

function AlertBanner({ opportunity }: { opportunity: MarketOpportunity }) {
  const cfg = INDICES_CONFIG[opportunity.label];
  const sr = opportunity.srAlert;
  const srLabel = sr?.srAlertType === "touched" ? "Niveau touché"
    : sr?.srAlertType === "approaching" ? "Approche S/R"
    : "Opportunité";

  const alertColor = sr?.srAlertType === "touched" ? "text-danger border-danger/40 bg-danger/10"
    : sr?.srAlertType === "approaching" ? "text-primary border-primary/40 bg-primary/10"
    : "text-yellow-400 border-yellow-400/40 bg-yellow-400/10";

  return (
    <div className={`p-4 rounded-xl border ${alertColor} ${sr?.srAlertType === "touched" ? "animate-pulse" : ""}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${sr?.srAlertType === "approaching" ? "bg-primary/20" : "bg-danger/20"}`}>
          {sr?.srAlertType === "approaching" ? <TrendingUp size={20} className="text-primary" /> : <AlertTriangle size={20} className="text-danger" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{srLabel} !</span>
            {opportunity.expectedDirection === "up" ? <ArrowUp size={18} className="text-success" /> : <ArrowDown size={18} className="text-danger" />}
          </div>
          <p className="text-sm mt-0.5">
            {opportunity.label} — {sr?.levelType === "support" ? "Support" : "Résistance"} à {sr?.levelPrice?.toFixed(2) ?? "—"} ({opportunity.spikeProbability}%)
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold font-mono">{opportunity.spikeProbability}%</div>
          <div className="text-xs">Probabilité</div>
        </div>
      </div>
      {sr && (
        <div className="grid grid-cols-4 gap-3 mt-3 text-xs">
          <div><span className="block opacity-50">Niveau {sr.levelType === "support" ? "S" : "R"}</span><span className="font-mono font-semibold">${sr.levelPrice.toFixed(2)}</span></div>
          <div><span className="block opacity-50">Force</span><span className="font-mono font-semibold">x{sr.levelStrength}</span></div>
          <div><span className="block opacity-50">Distance</span><span className="font-mono font-semibold">{sr.distancePercent}%</span></div>
          <div><span className="block opacity-50">Confluence TF</span><span className="font-mono font-semibold">{sr.tfConfluence}/3</span></div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {opportunity.sRlevels.slice(0, 4).map((level, i) => (
          <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium ${level.type === "support" ? "bg-success/10 text-success border border-success/20" : "bg-danger/10 text-danger border border-danger/20"}`}>
            ${level.price.toLocaleString(undefined, { minimumFractionDigits: 1 })} <span className="opacity-60">x{level.strength}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SignauxPage() {
  const [result, setResult] = useState<MarketScanResult | null>(null);
  const [connected, setConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alertHistory, setAlertHistory] = useState<MarketOpportunity[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [paused, setPaused] = useState(false);
  const [waitingData, setWaitingData] = useState(true);
  const [expandedOpportunity, setExpandedOpportunity] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<"indices" | "news">("indices");

  const previousImminentRef = useState<string[]>([])[0];
  const audioCtxRef = useState<AudioContext | null>(null)[0];
  const pausedRef = useState(false)[0];

  const playAlertSound = () => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  };

  useEffect(() => {
    initDerivClient();
    const interval = setInterval(() => {
      if (paused) return;
      try {
        const data = scanAllMarkets();
        if (!data) return;
        setResult(data as unknown as MarketScanResult);
        const isConnected = data.source === "deriv-live";
        setConnected(isConnected);
        if (isConnected) {
          setWaitingData(data.opportunities.length === 0);

          const imminent = data.opportunities.filter(o => o.isSpikeImminent);
          const newImminent = imminent.filter(o => !previousImminentRef.includes(`${o.type}_${o.number}`));
          if (newImminent.length > 0) {
            playAlertSound();
            for (const opp of newImminent) {
              const dirLabel = opp.expectedDirection === "up" ? "Hausse" : "Baisse";
              sendBrowserNotification(`Signal ${opp.label}`, `${dirLabel} — ${opp.spikeProbability}%`);
            }
            for (const opp of newImminent) {
              saveSignal({
                key: `${opp.type}_${opp.number}`,
                label: opp.label,
                type: opp.type,
                number: opp.number,
                direction: opp.expectedDirection,
                probability: opp.spikeProbability,
                entryPrice: opp.entryPrice ?? opp.currentPrice,
                stopLoss: opp.stopLoss ?? 0,
                takeProfit: opp.takeProfit ?? 0,
                magnitude: opp.estimatedMagnitude,
                timeSinceLastSpike: opp.timeSinceLastSpike,
                detectedAt: Date.now(),
                expiredAt: Date.now() + SIGNAL_EXPIRY_MS,
                resolvedAt: null,
                result: "active",
                exitPrice: null,
                exitReason: null,
                currentPriceAtExpiry: null,
                maxFavorable: 0,
                maxAdverse: 0,
              });
            }
            setAlertHistory(prev => [...newImminent, ...prev].slice(0, 50));
          }

          checkAndResolveSignals((key: string) => {
            const opp = data.opportunities.find((o: any) => `${o.type}_${o.number}` === key);
            return opp?.currentPrice ?? null;
          });
        }
      } catch {}
    }, 1000);
    return () => clearInterval(interval);
  }, [paused, soundEnabled, playAlertSound, previousImminentRef]);

  const [marketStats, setMarketStats] = useState<Record<string, { total: number; wins: number; winRate: number }>>({});
  useEffect(() => {
    const load = async () => { try { const s = await getSignalStats(); setMarketStats(s.byMarket); } catch {} };
    load();
    const i = setInterval(load, 10000);
    return () => clearInterval(i);
  }, []);

  const imminentOpps = result?.opportunities.filter(o => o.isSpikeImminent) ?? [];
  const goodOpps = result?.opportunities.filter(o => o.spikeProbability >= 80) ?? [];
  const displayedOpps = showAll ? (result?.opportunities ?? []) : goodOpps;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 bg-surface rounded-xl p-1 border border-border w-fit">
          <button onClick={() => setSelectedTab("indices")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${selectedTab === "indices" ? "bg-primary text-white shadow" : "text-text-secondary hover:text-text"}`}>
            <Gauge size={16} /> Indices Synthétiques
          </button>
          <button onClick={() => setSelectedTab("news")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${selectedTab === "news" ? "bg-primary text-white shadow" : "text-text-secondary hover:text-text"}`}>
            <Newspaper size={16} /> News Trading
          </button>
        </div>

        {selectedTab === "indices" && (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
                    <Gauge className="text-primary" size={32} />
                    Signaux Temps Réel
                  </h1>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${connected ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
                    {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
                    {connected ? "Live" : "Déconnecté"}
                  </div>
                </div>
                <p className="text-text-secondary text-sm">Scanner automatique BOOM & CRASH — Support/Résistance + Squeeze + Confluence TF</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setSoundEnabled(!soundEnabled)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${soundEnabled ? "bg-surface border border-border text-text-secondary" : "bg-danger/10 text-danger border border-danger/30"}`}>
                  {soundEnabled ? <Bell size={14} /> : <BellOff size={14} />} {soundEnabled ? "Son ON" : "Son OFF"}
                </button>
                <button onClick={() => setShowAll(!showAll)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showAll ? "bg-primary/15 text-primary border border-primary/30" : "bg-surface border border-border text-text-secondary"}`}>
                  {showAll ? "Filtrer" : "Voir tout"}
                </button>
                <button onClick={() => setPaused(!paused)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${paused ? "bg-warning/20 text-warning border border-warning/30" : "bg-surface border border-border text-text-secondary"}`}>
                  {paused ? "Reprendre" : "Pause"}
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="rounded-xl border border-border bg-surface p-4 text-center">
                <AlertTriangle size={18} className="mx-auto text-danger mb-1" />
                <p className="text-2xl font-bold text-danger">{imminentOpps.length}</p>
                <p className="text-xs text-text-muted">Spike imminent</p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4 text-center">
                <Gauge size={18} className="mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold text-primary">{result?.totalAnalyzed ?? 0}/6</p>
                <p className="text-xs text-text-muted">Indices analysés</p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4 text-center">
                <TrendingUp size={18} className="mx-auto text-success mb-1" />
                <p className="text-2xl font-bold text-success">{goodOpps.length}</p>
                <p className="text-xs text-text-muted">Signaux ≥80%</p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4 text-center">
                <BarChart3 size={18} className="mx-auto text-warning mb-1" />
                <p className="text-2xl font-bold text-warning">{alertHistory.length}</p>
                <p className="text-xs text-text-muted">Alertes récentes</p>
              </div>
            </div>

            {/* Connection / Waiting */}
            {connected && waitingData && (
              <div className="mb-6 p-4 rounded-xl border border-border bg-surface/50 text-center text-sm text-text-secondary animate-pulse">
                <Loader2 size={16} className="inline mr-2 animate-spin text-primary" />
                Connexion établie, chargement des données historiques...
              </div>
            )}
            {!connected && (
              <div className="mb-6 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 text-center text-sm text-text-secondary">
                <AlertTriangle size={16} className="inline mr-2 text-warning" />
                Connexion WebSocket en cours...
              </div>
            )}

            {/* Alert Banners */}
            {imminentOpps.length > 0 && (
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-danger animate-ping" />
                  <span className="text-sm font-semibold text-danger">Spike imminent sur {imminentOpps.map(o => o.label).join(", ")}</span>
                </div>
                {imminentOpps.map(opp => (
                  <AlertBanner key={`${opp.type}_${opp.number}`} opportunity={opp} />
                ))}
              </div>
            )}

            {connected && !waitingData && goodOpps.length === 0 && !showAll && (
              <div className="mb-6 p-4 rounded-xl border border-border bg-surface/50 text-center text-sm text-text-secondary">
                <Gauge size={20} className="inline mr-2 text-primary" />
                Aucune opportunité ≥80% pour le moment. Le scan surveille les 6 indices en continu.
              </div>
            )}

            {/* Table */}
            {result && displayedOpps.length > 0 && (
              <div className="rounded-xl border border-border bg-surface overflow-hidden mb-8">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-xs text-text-muted uppercase">
                        <th className="text-left px-4 py-3 font-semibold">Marché</th>
                        <th className="text-left px-4 py-3 font-semibold">S/R</th>
                        <th className="text-right px-4 py-3 font-semibold">Probabilité</th>
                        <th className="text-right px-4 py-3 font-semibold">Fiabilité</th>
                        <th className="text-right px-4 py-3 font-semibold">Direction</th>
                        <th className="text-right px-4 py-3 font-semibold">Ampleur</th>
                        <th className="text-right px-4 py-3 font-semibold">Dernier spike</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedOpps.map((opp) => {
                        const cfg = INDICES_CONFIG[opp.label] ?? { color: "#94a3b8", bgColor: "rgba(148,163,184,0.1)" };
                        const probColor = opp.isSpikeImminent ? "#ef4444" : opp.spikeProbability > 50 ? "#f59e0b" : "#22c55e";
                        return (
                          <tr key={`${opp.type}_${opp.number}`}
                            className={`border-b border-border/50 text-sm transition-colors ${opp.isSpikeImminent ? "bg-danger/5" : "hover:bg-surface-light/50"}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {opp.type === "BOOM" ? <Flame size={14} style={{ color: cfg.color }} /> : <Droplet size={14} style={{ color: cfg.color }} />}
                                <span className="font-semibold" style={{ color: cfg.color }}>{opp.label}</span>
                                {opp.isSpikeImminent && (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-danger/20 text-danger border border-danger/30">ALERTE</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {(() => {
                                const sa = opp.srAlert;
                                if (!sa || !sa.hasSRLevel) return <span className="text-xs text-text-muted">—</span>;
                                const typeColor = sa.srAlertType === "touched" ? "text-danger" : sa.srAlertType === "approaching" ? "text-primary" : "text-text-muted";
                                const typeLabel = sa.srAlertType === "touched" ? "Touché" : sa.srAlertType === "approaching" ? "Approche" : "—";
                                const levelLabel = sa.levelType === "support" ? "S" : "R";
                                return (
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-[10px] font-bold ${typeColor}`}>{levelLabel}{sa.levelStrength}</span>
                                    {sa.srAlertType !== "none" && <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${sa.srAlertType === "touched" ? "bg-danger/15 text-danger" : "bg-primary/15 text-primary"}`}>{typeLabel}</span>}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-20 h-1.5 rounded-full bg-surface-light overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${opp.spikeProbability}%`, background: probColor }} />
                                </div>
                                <span className="font-mono text-xs font-bold" style={{ color: probColor }}>{opp.spikeProbability}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {(() => {
                                const ms = marketStats[`${opp.type}_${opp.number}`];
                                if (!ms || ms.total < 3) return <span className="text-xs text-text-muted">—</span>;
                                const relColor = ms.winRate >= 70 ? "text-success" : ms.winRate >= 50 ? "text-warning" : "text-danger";
                                return <span className={`font-mono text-xs font-bold ${relColor}`}>{ms.winRate.toFixed(0)}% <span className="text-text-muted font-normal">({ms.wins}/{ms.total})</span></span>;
                              })()}
                            </td>
                            <td className={`px-4 py-3 text-right font-semibold capitalize ${opp.expectedDirection === "up" ? "text-success" : "text-danger"}`}>{opp.expectedDirection === "up" ? "Hausse ↗" : "Baisse ↘"}</td>
                            <td className="px-4 py-3 text-right font-mono text-xs text-text-secondary">{opp.estimatedMagnitude}</td>
                            <td className="px-4 py-3 text-right text-xs text-text-secondary">{opp.timeSinceLastSpike > 60 ? `${Math.round(opp.timeSinceLastSpike / 60)}m` : `${opp.timeSinceLastSpike}s`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!showAll && goodOpps.length < (result?.opportunities?.length ?? 0) && (
                  <div className="px-4 py-2 border-t border-border/50 text-center">
                    <button onClick={() => setShowAll(true)} className="text-xs text-primary hover:text-primary/80 transition-colors">
                      + {((result?.opportunities?.length ?? 0) - goodOpps.length)} marchés sous les 80%
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Expanded detail */}
            {expandedOpportunity && result && (
              <div className="mb-8 rounded-xl border border-border bg-surface p-5">
                {(() => {
                  const opp = result.opportunities.find(o => `${o.type}_${o.number}` === expandedOpportunity);
                  if (!opp) return null;
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg">{opp.label} — Analyse détaillée</h3>
                        <button onClick={() => setExpandedOpportunity(null)} className="text-xs text-text-muted hover:text-text transition-colors">Fermer</button>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div className="rounded-lg bg-background border border-border p-3">
                          <p className="text-[10px] text-text-muted uppercase font-semibold">Niveau S/R</p>
                          <p className="text-lg font-bold font-mono mt-1">
                            {opp.srAlert ? <span>{opp.srAlert.levelType === "support" ? "S" : "R"}${opp.srAlert.levelPrice.toFixed(2)} <span className="text-xs text-text-muted">x{opp.srAlert.levelStrength}</span></span> : "—"}
                          </p>
                        </div>
                        <div className="rounded-lg bg-background border border-border p-3">
                          <p className="text-[10px] text-text-muted uppercase font-semibold">Statut S/R</p>
                          <p className="text-lg font-bold font-mono mt-1">
                            {opp.srAlert?.srAlertType === "touched" ? <span className="text-danger">Touché</span> : opp.srAlert?.srAlertType === "approaching" ? <span className="text-primary">Approche ⚡</span> : <span className="text-text-muted">—</span>}
                          </p>
                        </div>
                        <div className="rounded-lg bg-background border border-border p-3">
                          <p className="text-[10px] text-text-muted uppercase font-semibold">Fiabilité réelle</p>
                          <p className="text-lg font-bold font-mono mt-1">
                            {(() => {
                              const ms = marketStats[`${opp.type}_${opp.number}`];
                              if (!ms || ms.total < 3) return <span className="text-text-muted">—</span>;
                              return <span className={ms.winRate >= 70 ? "text-success" : ms.winRate >= 50 ? "text-warning" : "text-danger"}>{ms.winRate.toFixed(0)}% ({ms.wins}/{ms.total})</span>;
                            })()}
                          </p>
                        </div>
                        <div className="rounded-lg bg-background border border-border p-3">
                          <p className="text-[10px] text-text-muted uppercase font-semibold">Confluence TF</p>
                          <p className="text-lg font-bold font-mono mt-1">{opp.srAlert?.tfConfluence ?? "—"}/3</p>
                        </div>
                      </div>
                      {opp.sRlevels.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-text-muted uppercase mb-2">Niveaux S/R</p>
                          <div className="flex flex-wrap gap-1.5">
                            {opp.sRlevels.map((level, i) => (
                              <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-medium ${level.type === "support" ? "bg-success/10 text-success border border-success/20" : "bg-danger/10 text-danger border border-danger/20"}`}>
                                ${level.price.toLocaleString(undefined, { minimumFractionDigits: 1 })} <span className="opacity-60">x{level.strength}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {opp.orderBlocks.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-text-muted uppercase mb-2">Ordres Blocs</p>
                          <div className="flex flex-wrap gap-1.5">
                            {opp.orderBlocks.map((ob, i) => (
                              <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-medium ${ob.type === "bullish" ? "bg-success/10 text-success border border-success/20" : "bg-danger/10 text-danger border border-danger/20"}`}>
                                ${ob.price.toLocaleString(undefined, { minimumFractionDigits: 1 })} <span className="opacity-60">{ob.type === "bullish" ? "OB+" : "OB-"} {ob.strength}x</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Chart */}
            <div className="mb-8" id="chart">
              <DerivChart />
            </div>

            {/* Alert History */}
            {alertHistory.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-text-muted uppercase">Historique des alertes</h3>
                  <button onClick={() => setAlertHistory([])} className="text-xs text-text-muted hover:text-text transition-colors">Effacer</button>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {alertHistory.slice(0, 20).map((alert, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-danger/5 border border-danger/10 text-xs">
                      <div className="flex items-center gap-2">
                        {alert.type === "BOOM" ? <Flame size={12} className="text-success" /> : <Droplet size={12} className="text-danger" />}
                        <span className="font-semibold">{alert.label}</span>
                        <span className={`capitalize ${alert.expectedDirection === "up" ? "text-success" : "text-danger"}`}>{alert.expectedDirection === "up" ? "↑ Hausse" : "↓ Baisse"}</span>
                      </div>
                      <div className="flex items-center gap-3 text-text-muted">
                        <span className="font-mono font-semibold text-danger">{alert.spikeProbability}%</span>
                        <span className="font-mono">{alert.estimatedMagnitude}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8">
              <AdBanner />
            </div>

            {/* Explication du système */}
            <div className="mt-12 rounded-xl border border-border bg-surface p-6">
              <h3 className="font-bold text-lg mb-4">Comment l'analyse fonctionne</h3>
              <div className="grid md:grid-cols-2 gap-6 text-sm">
                <div>
                  <h4 className="font-semibold text-primary mb-2">Support & Résistance</h4>
                  <p className="text-text-secondary leading-relaxed">
                    Détection des pivots (swing highs/lows) sur 4 timeframes (15m, 30m, 1h, 2h). 
                    Un niveau S/R avec confluence sur plusieurs TF est plus fort. 
                    Le prix qui s'en approche déclenche une alerte <strong>Approche</strong>, 
                    s'il le touche → <strong>Touché</strong> (risque de rebond = spike).
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-primary mb-2">Squeeze Detection</h4>
                  <p className="text-text-secondary leading-relaxed">
                    Avant un spike, le prix reste "coincé" au point extrême (bas pour Boom, haut pour Crash). 
                    Si le prix stagne dans 0.1% de ce point pendant 30+ ticks → <strong>Squeeze actif</strong>. 
                    Plus la durée est longue, plus le spike sera fort.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-primary mb-2">Score de probabilité</h4>
                  <p className="text-text-secondary leading-relaxed">
                    Moyenne pondérée : S/R (35%), RSI (12%), tendance marché (12%), 
                    modèle d'intervalles Weibull (8%), features avancées (5-11%),
                    tendance du jour (8%), squeeze bonus (jusqu'à 25%).
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-primary mb-2">Filtres qualité</h4>
                  <p className="text-text-secondary leading-relaxed">
                    Cooldown 6h entre signaux, jamais à contre-tendance du jour, 
                    nécessite niveau touché + confluence ≥ 2TF + volatilité suffisante, 
                    OU squeeze prolongé + score ≥ 0.5. 
                    Les seuils s'adaptent au win rate historique de chaque indice.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {selectedTab === "news" && (
          <>
            <NewsTrader />
            <div className="mt-8">
              <AdBanner />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
