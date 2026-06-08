"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  TrendingUp, AlertTriangle, Flame, Droplet,
  Wifi, WifiOff, Bell, BellOff,
  ArrowUp, ArrowDown, Gauge,
} from "lucide-react";
import { initDerivClient, scanAllMarkets } from "@/lib/deriv";
import type { MarketScanResult, MarketOpportunity } from "@/lib/deriv";

type Opportunity = MarketOpportunity;
type ScanResult = MarketScanResult;

const INDICES_CONFIG: Record<string, { color: string; bgColor: string }> = {
  "Boom 500": { color: "#22c55e", bgColor: "rgba(34,197,94,0.1)" },
  "Boom 900": { color: "#16a34a", bgColor: "rgba(22,163,74,0.1)" },
  "Boom 1000": { color: "#15803d", bgColor: "rgba(21,128,61,0.1)" },
  "Crash 500": { color: "#fb7185", bgColor: "rgba(251,113,133,0.1)" },
  "Crash 900": { color: "#f43f5e", bgColor: "rgba(244,63,94,0.1)" },
  "Crash 1000": { color: "#be123c", bgColor: "rgba(190,18,60,0.1)" },
};

function AlertBanner({ opportunity }: { opportunity: Opportunity }) {
  const cfg = INDICES_CONFIG[opportunity.label];
  return (
    <div className="p-4 rounded-xl border border-danger/40 bg-danger/10 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-danger/20 flex items-center justify-center">
          <AlertTriangle size={20} className="text-danger" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-danger">Opportunité détectée !</span>
            {opportunity.expectedDirection === "up" ? (
              <ArrowUp size={18} className="text-success" />
            ) : (
              <ArrowDown size={18} className="text-danger" />
            )}
          </div>
          <p className="text-sm text-danger/80 mt-0.5">
            {opportunity.label} — {opportunity.expectedDirection === "up" ? "Hausse" : "Baisse"} imminente ({opportunity.spikeProbability}%)
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold font-mono text-danger">{opportunity.spikeProbability}%</div>
          <div className="text-xs text-danger/70">Probabilité</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-3 text-xs text-danger/70">
        <div>
          <span className="block text-danger/50">Prix</span>
          <span className="font-mono font-semibold text-danger">
            ${opportunity.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div>
          <span className="block text-danger/50">Ampleur estimée</span>
          <span className="font-mono font-semibold text-danger">{opportunity.estimatedMagnitude}</span>
        </div>
        <div>
          <span className="block text-danger/50">Dernier spike</span>
          <span className="font-mono font-semibold text-danger">
            {opportunity.timeSinceLastSpike > 60
              ? `${Math.round(opportunity.timeSinceLastSpike / 60)}m`
              : `${opportunity.timeSinceLastSpike}s`}
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {opportunity.sRlevels.slice(0, 4).map((level, i) => (
          <span key={i}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium
              ${level.type === "support"
                ? "bg-success/10 text-success border border-success/20"
                : "bg-danger/10 text-danger border border-danger/20"}`}
          >
            ${level.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}
            <span className="opacity-60">x{level.strength}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface-light overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="font-mono text-xs font-semibold" style={{ color }}>{value}%</span>
    </div>
  );
}

export default function MarketScanner() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [connected, setConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alertHistory, setAlertHistory] = useState<Opportunity[]>([]);
  const [previousImminent, setPreviousImminent] = useState<string[]>([]);
  const [expandedOpportunity, setExpandedOpportunity] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  pausedRef.current = paused;

  const playAlertSound = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
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
    } catch { /* audio not available */ }
  }, [soundEnabled]);

  const fetchScan = useCallback(() => {
    if (pausedRef.current) return;
    try {
      const data = scanAllMarkets();
      setResult(data as unknown as ScanResult);
      const isConnected = data.source === "deriv-live";
      setConnected(isConnected);

      if (isConnected) {
        const imminentKeys = data.opportunities
          .filter(o => o.isSpikeImminent)
          .map(o => `${o.type}_${o.number}`);

        const newAlerts = imminentKeys.filter(k => !previousImminent.includes(k));
        if (newAlerts.length > 0) {
          playAlertSound();
          const newOpps = data.opportunities.filter(o =>
            newAlerts.includes(`${o.type}_${o.number}`)
          );
          setAlertHistory(prev => [...newOpps, ...prev].slice(0, 50));
        }
        setPreviousImminent(imminentKeys);
      }
    } catch { /* ignore */ }
  }, [playAlertSound, previousImminent]);

  useEffect(() => {
    initDerivClient();
    fetchScan();
    const interval = setInterval(fetchScan, 1000);
    return () => clearInterval(interval);
  }, [fetchScan]);

  const [showAll, setShowAll] = useState(false);
  const imminentOpps = result?.opportunities.filter(o => o.isSpikeImminent) ?? [];
  const goodOpps = result?.opportunities.filter(o => o.spikeProbability >= 80) ?? [];
  const displayedOpps = showAll ? (result?.opportunities ?? []) : goodOpps;

  return (
    <section id="scanner" className="py-20 px-4 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
                <Gauge className="text-primary" size={32} />
                Scan Automatique du Marché
              </h2>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${connected ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
                {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
                {connected ? "Live" : "Déconnecté"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSoundEnabled(!soundEnabled); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${soundEnabled ? "bg-surface border border-border text-text-secondary" : "bg-danger/10 text-danger border border-danger/30"}`}
            >
              {soundEnabled ? <Bell size={14} /> : <BellOff size={14} />}
              {soundEnabled ? "Son ON" : "Son OFF"}
            </button>
            <button
              onClick={() => { setShowAll(!showAll); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showAll ? "bg-primary/15 text-primary border border-primary/30" : "bg-surface border border-border text-text-secondary"}`}
            >
              {showAll ? "Filtrer" : "Voir tout"}
            </button>
            <button
              onClick={() => { setPaused(!paused); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${paused ? "bg-warning/20 text-warning border border-warning/30" : "bg-surface border border-border text-text-secondary"}`}
            >
              {paused ? "Reprendre" : "Pause"}
            </button>
          </div>
        </div>

        {connected && goodOpps.length === 0 && !showAll && (
          <div className="mb-6 p-4 rounded-xl border border-border bg-surface/50 text-center text-sm text-text-secondary">
            <Gauge size={20} className="inline mr-2 text-primary" />
            Aucune opportunité significative pour le moment. Le scan surveille les 6 indices en continu.
          </div>
        )}

        {imminentOpps.length > 0 && (
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-danger animate-ping" />
              <span className="text-sm font-semibold text-danger">
                Spike imminent sur {imminentOpps.map(o => o.label).join(", ")}
              </span>
            </div>
            {imminentOpps.map(opp => (
              <AlertBanner key={`${opp.type}_${opp.number}`} opportunity={opp} />
            ))}
          </div>
        )}

        {result && displayedOpps.length > 0 && (
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-xs text-text-muted uppercase">
                    <th className="text-left px-4 py-3 font-semibold">Marché</th>
                    <th className="text-right px-4 py-3 font-semibold">Probabilité</th>
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
                        className={`border-b border-border/50 text-sm transition-colors cursor-pointer
                          ${opp.isSpikeImminent ? "bg-danger/5" : "hover:bg-surface-light/50"}`}
                        onClick={() => setExpandedOpportunity(
                          expandedOpportunity === `${opp.type}_${opp.number}` ? null : `${opp.type}_${opp.number}`
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {opp.type === "BOOM" ? <Flame size={14} style={{ color: cfg.color }} /> : <Droplet size={14} style={{ color: cfg.color }} />}
                            <span className="font-semibold" style={{ color: cfg.color }}>{opp.label}</span>
                            {opp.isSpikeImminent && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-danger/20 text-danger border border-danger/30">
                                ALERTE
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-surface-light overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${opp.spikeProbability}%`, background: probColor }} />
                            </div>
                            <span className="font-mono text-xs font-bold" style={{ color: probColor }}>{opp.spikeProbability}%</span>
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold capitalize ${opp.expectedDirection === "up" ? "text-success" : "text-danger"}`}>
                          {opp.expectedDirection === "up" ? "Hausse ↗" : "Baisse ↘"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-text-secondary">
                          {opp.estimatedMagnitude}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-text-secondary">
                          {opp.timeSinceLastSpike > 60
                            ? `${Math.round(opp.timeSinceLastSpike / 60)}m`
                            : `${opp.timeSinceLastSpike}s`}
                        </td>
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

        {expandedOpportunity && result && (
          <div className="mt-4 rounded-xl border border-border bg-surface p-5">
            {(() => {
              const opp = result.opportunities.find(o => `${o.type}_${o.number}` === expandedOpportunity);
              if (!opp) return null;
              return (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg">{opp.label} — Analyse détaillée</h3>
                    <button
                      onClick={() => setExpandedOpportunity(null)}
                      className="text-xs text-text-muted hover:text-text transition-colors"
                    >Fermer</button>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div className="rounded-lg bg-background border border-border p-3">
                      <p className="text-[10px] text-text-muted uppercase font-semibold">Up Score (Support)</p>
                      <p className="text-lg font-bold font-mono text-success mt-1">{opp.upScore}%</p>
                    </div>
                    <div className="rounded-lg bg-background border border-border p-3">
                      <p className="text-[10px] text-text-muted uppercase font-semibold">Down Score (Résistance)</p>
                      <p className="text-lg font-bold font-mono text-danger mt-1">{opp.downScore}%</p>
                    </div>
                    <div className="rounded-lg bg-background border border-border p-3">
                      <p className="text-[10px] text-text-muted uppercase font-semibold">Mouvements consécutifs</p>
                      <p className="text-lg font-bold font-mono mt-1">{opp.consecutiveMoves}/5</p>
                    </div>
                    <div className="rounded-lg bg-background border border-border p-3">
                      <p className="text-[10px] text-text-muted uppercase font-semibold">Distance du niveau</p>
                      <p className="text-lg font-bold font-mono mt-1">{opp.distancePercent}%</p>
                    </div>
                  </div>
                  {opp.sRlevels.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-text-muted uppercase mb-2">Niveaux S/R</p>
                      <div className="flex flex-wrap gap-1.5">
                        {opp.sRlevels.map((level, i) => (
                          <span key={i}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-medium
                              ${level.type === "support"
                                ? "bg-success/10 text-success border border-success/20"
                                : "bg-danger/10 text-danger border border-danger/20"}`}
                          >
                            ${level.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                            <span className="opacity-60">x{level.strength}</span>
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
                          <span key={i}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-medium
                              ${ob.type === "bullish"
                                ? "bg-success/10 text-success border border-success/20"
                                : "bg-danger/10 text-danger border border-danger/20"}`}
                          >
                            ${ob.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                            <span className="opacity-60">{ob.type === "bullish" ? "OB+" : "OB-"} {ob.strength}x</span>
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

        {alertHistory.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-muted uppercase">Historique des alertes</h3>
              <button
                onClick={() => setAlertHistory([])}
                className="text-xs text-text-muted hover:text-text transition-colors"
              >Effacer</button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {alertHistory.slice(0, 20).map((alert, i) => (
                <div key={i}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-danger/5 border border-danger/10 text-xs"
                >
                  <div className="flex items-center gap-2">
                    {alert.type === "BOOM" ? <Flame size={12} className="text-success" /> : <Droplet size={12} className="text-danger" />}
                    <span className="font-semibold">{alert.label}</span>
                    <span className={`capitalize ${alert.expectedDirection === "up" ? "text-success" : "text-danger"}`}>
                      {alert.expectedDirection === "up" ? "↑ Hausse" : "↓ Baisse"}
                    </span>
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

        {!connected && (
          <div className="mt-4 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 text-center text-sm text-text-secondary">
            <AlertTriangle size={16} className="inline mr-2 text-warning" />
            Connexion WebSocket en cours...
          </div>
        )}
      </div>
    </section>
  );
}
