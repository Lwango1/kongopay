"use client";

import { useEffect, useState, useCallback } from "react";
import { Zap, Brain, TrendingUp, TrendingDown, Flame, Droplet, AlertTriangle, BarChart3, ArrowUpFromLine, ArrowDownFromLine, ExternalLink } from "lucide-react";

interface IndexData {
  price: number;
  change24h: number;
  history: number[];
  type: string;
  number: number;
  lastSpikeTime: number;
  lastSpikeDirection: "up" | "down" | null;
}

interface SRLevel {
  price: number;
  strength: number;
  type: "support" | "resistance";
}

interface SpikePrediction {
  spikeProbability: number;
  expectedDirection: string;
  estimatedMagnitude: string;
  timeSinceLastSpike: number;
  isSpikeImminent: boolean;
  pricePosition: number;
  consecutiveMoves: number;
  rangeLow: number;
  rangeHigh: number;
  referenceLevel: number;
  referenceStrength: number;
  distancePercent: number;
  sRlevels: SRLevel[];
  connected: boolean;
}

const INDICES = [
  { type: "BOOM", number: 500, icon: Flame, color: "#22c55e", label: "Boom 500", symbol: "BOOM500" },
  { type: "BOOM", number: 900, icon: Flame, color: "#16a34a", label: "Boom 900", symbol: "BOOM900" },
  { type: "BOOM", number: 1000, icon: Flame, color: "#15803d", label: "Boom 1000", symbol: "BOOM1000" },
  { type: "CRASH", number: 500, icon: Droplet, color: "#fb7185", label: "Crash 500", symbol: "CRASH500" },
  { type: "CRASH", number: 900, icon: Droplet, color: "#f43f5e", label: "Crash 900", symbol: "CRASH900" },
  { type: "CRASH", number: 1000, icon: Droplet, color: "#be123c", label: "Crash 1000", symbol: "CRASH1000" },
];

const DERIV_URL = "https://app.deriv.com/trading";

export default function PredictionGame() {
  const [state, setState] = useState<Record<string, IndexData> | null>(null);
  const [spike, setSpike] = useState<SpikePrediction | null>(null);
  const [activeKey, setActiveKey] = useState("BOOM_500");

  const fetchState = useCallback(async () => {
    try {
      const [stateRes, spikeRes] = await Promise.all([
        fetch("/api/deriv/state"),
        fetch(`/api/deriv/spike?${activeKey.replace("_", "&number=").replace("BOOM", "type=BOOM").replace("CRASH", "type=CRASH")}`),
      ]);
      if (stateRes.ok) setState(await stateRes.json());
      if (spikeRes.ok) {
        const data = await spikeRes.json();
        setSpike(data.prediction);
      }
    } catch { /* ignore */ }
  }, [activeKey]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 1000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const activeIdx = INDICES.find((i) => `${i.type}_${i.number}` === activeKey);
  const currentIdxData = state?.[activeKey];
  const price = currentIdxData?.price ?? 0;
  const change = currentIdxData?.change24h ?? 0;
  const history = currentIdxData?.history ?? [];
  const minH = Math.min(...history, 0);
  const maxH = Math.max(...history, 1);
  const range = maxH - minH || 1;

  const spikeColor = spike?.isSpikeImminent ? "#ef4444" : spike && spike.spikeProbability > 50 ? "#f59e0b" : "#22c55e";

  const hasSupport = spike?.sRlevels?.some(l => l.type === "support") ?? false;
  const hasResistance = spike?.sRlevels?.some(l => l.type === "resistance") ?? false;

  return (
    <section className="py-20 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 flex items-center justify-center gap-3">
            <Brain className="text-primary" size={32} />
            Analyse Automatique du Marché
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            Analyse en temps réel basée sur les niveaux de Support & Résistance. L&apos;algorithme détecte automatiquement les zones de retournement.
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-2">
            {INDICES.map((idx) => {
              const key = `${idx.type}_${idx.number}`;
              const isActive = key === activeKey;
              return (
                <button key={key} onClick={() => { setActiveKey(key); setSpike(null); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-surface border border-primary/40 text-text" : "bg-background border border-border text-text-secondary hover:bg-surface hover:border-border"}`}>
                  <idx.icon size={18} style={{ color: idx.color }} />
                  <span>{idx.label}</span>
                  {state?.[key] && (
                    <span className={`ml-auto text-xs font-mono ${(state[key].change24h ?? 0) >= 0 ? "text-success" : "text-danger"}`}>
                      {(state[key].change24h ?? 0) >= 0 ? "+" : ""}{(state[key].change24h ?? 0).toFixed(1)}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {activeIdx && <activeIdx.icon size={20} style={{ color: activeIdx.color }} />}
                  <span className="font-semibold">{activeIdx?.label ?? "Select"}</span>
                </div>
                <span className={`text-sm font-mono ${change >= 0 ? "text-success" : "text-danger"}`}>
                  {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-3xl font-bold font-mono">
                  ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <a href={`${DERIV_URL}?symbol=${activeIdx?.symbol}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all">
                  <ExternalLink size={14} />
                  Comparez sur Deriv
                </a>
              </div>
              <div className="h-40 flex items-end gap-[2px]">
                {history.slice(-80).map((p, i) => (
                  <div key={i} className="flex-1 rounded-t-sm transition-all"
                    style={{
                      height: `${((p - minH) / range) * 100}%`,
                      background: activeIdx?.type === "BOOM"
                        ? `rgba(34, 197, 94, ${0.3 + (p / maxH) * 0.5})`
                        : `rgba(251, 113, 133, ${0.3 + (p / maxH) * 0.5})`,
                    }} />
                ))}
              </div>
            </div>

            {spike && (
              <>
                <div className={`rounded-xl border p-4 transition-all ${spike.isSpikeImminent ? "border-red-500/50 bg-red-500/10" : spike.spikeProbability > 50 ? "border-yellow-500/30 bg-yellow-500/5" : "border-border bg-surface/50"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 size={18} style={{ color: spikeColor }} />
                      <span className="font-semibold text-sm">Analyse Algorithmique</span>
                    </div>
                    <span className="text-lg font-bold font-mono" style={{ color: spikeColor }}>
                      {spike.spikeProbability}%
                    </span>
                  </div>
                  <div className="mt-2 w-full h-1.5 rounded-full bg-surface-light overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${spike.spikeProbability}%`, background: spikeColor }} />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs text-text-secondary">
                    <div>
                      <span className="text-text-muted">Direction prédite</span>
                      <p className={`font-semibold capitalize flex items-center gap-1 ${spike.expectedDirection === "up" ? "text-success" : "text-danger"}`}>
                        {spike.expectedDirection === "up" ? <><TrendingUp size={14} /> Hausse</> : <><TrendingDown size={14} /> Baisse</>}
                      </p>
                    </div>
                    <div>
                      <span className="text-text-muted">Ampleur estimée</span>
                      <p className="font-semibold text-text">{spike.estimatedMagnitude}</p>
                    </div>
                    <div>
                      <span className="text-text-muted">Niveau de référence</span>
                      <p className="font-semibold text-text font-mono">${spike.referenceLevel?.toFixed(2) ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-text-muted">Force du niveau</span>
                      <p className="font-semibold text-text">{spike.referenceStrength} touché(s)</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-text-secondary leading-relaxed">
                      <span className="text-text-muted">Raisonnement : </span>
                      {activeIdx?.type === "BOOM"
                        ? `Le prix est à ${spike.pricePosition}% du range, proche du support (${spike.referenceStrength} touchés). ${spike.consecutiveMoves} baisses consécutives signalent un épuisement → l'algorithme anticipe un rebond.`
                        : `Le prix est à ${spike.pricePosition}% du range, proche de la résistance (${spike.referenceStrength} touchés). ${spike.consecutiveMoves} hausses consécutives signalent un essoufflement → l'algorithme anticipe un repli.`}
                    </p>
                  </div>

                  {spike.isSpikeImminent && (
                    <div className="mt-2 flex items-center gap-2 text-red-400 animate-pulse text-sm font-semibold">
                      <AlertTriangle size={14} />
                      Spike imminent détecté ! Probabilité élevée ({spike.spikeProbability}%).
                    </div>
                  )}
                </div>

                {spike.sRlevels && spike.sRlevels.length > 0 && (
                  <div className="rounded-xl border border-border bg-surface/50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ArrowUpFromLine size={14} className="text-success" />
                      <ArrowDownFromLine size={14} className="text-danger" />
                      <span className="font-semibold text-sm">Niveaux Support & Résistance</span>
                    </div>
                    <div className="space-y-1.5">
                      {spike.sRlevels.slice(0, 6).map((level, i) => {
                        const isSupport = level.type === "support";
                        const proximity = Math.abs((level.price - price) / price * 100);
                        const isNear = proximity < 0.5;
                        return (
                          <div key={i} className={`flex items-center justify-between py-1.5 px-3 rounded-lg text-xs ${isNear ? "bg-primary/10 border border-primary/20" : "bg-background border border-border"}`}>
                            <div className="flex items-center gap-2">
                              {isSupport
                                ? <ArrowUpFromLine size={12} className="text-success" />
                                : <ArrowDownFromLine size={12} className="text-danger" />}
                              <span className={`font-mono font-semibold ${isSupport ? "text-success" : "text-danger"}`}>
                                ${level.price.toFixed(2)}
                              </span>
                              <span className="text-text-muted">({isSupport ? "Support" : "Résistance"})</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-text-muted">{level.strength}x touché</span>
                              {isNear && <span className="text-warning text-[10px] font-semibold">Proche</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-[10px] text-text-muted">
                      <span>Prix actuel: <strong className="text-text font-mono">${price.toFixed(2)}</strong></span>
                      <span>Distance au support: <strong className="text-success font-mono">
                        {hasSupport
                          ? `${Math.abs((price - Math.max(...spike.sRlevels.filter(l => l.type === "support").map(l => l.price))) / price * 100).toFixed(2)}%`
                          : "—"}
                      </strong></span>
                      <span>Distance à la résistance: <strong className="text-danger font-mono">
                        {hasResistance
                          ? `${Math.abs((Math.min(...spike.sRlevels.filter(l => l.type === "resistance").map(l => l.price)) - price) / price * 100).toFixed(2)}%`
                          : "—"}
                      </strong></span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border bg-surface/50 p-3 text-center">
                    <p className="text-[10px] text-text-muted uppercase font-semibold">Consecutifs</p>
                    <p className="text-lg font-bold font-mono mt-1">{spike.consecutiveMoves}/5</p>
                    <p className="text-[10px] text-text-secondary">{activeIdx?.type === "BOOM" ? "baisses" : "hausses"}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface/50 p-3 text-center">
                    <p className="text-[10px] text-text-muted uppercase font-semibold">Position</p>
                    <p className="text-lg font-bold font-mono mt-1">{spike.pricePosition}%</p>
                    <p className="text-[10px] text-text-secondary">du range S/R</p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface/50 p-3 text-center">
                    <p className="text-[10px] text-text-muted uppercase font-semibold">Dernier spike</p>
                    <p className="text-lg font-bold font-mono mt-1">{spike.timeSinceLastSpike > 60 ? `${Math.round(spike.timeSinceLastSpike / 60)}m` : `${spike.timeSinceLastSpike}s`}</p>
                    <p className="text-[10px] text-text-secondary">il y a</p>
                  </div>
                </div>
              </>
            )}

            {!spike?.connected && (
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-center text-sm text-text-secondary">
                <AlertTriangle size={16} className="inline mr-2 text-warning" />
                Connexion WebSocket en cours... Données non disponibles.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
