"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Brain, TrendingUp, TrendingDown, Flame, Droplet, AlertTriangle, BarChart3,
  ArrowUpFromLine, ArrowDownFromLine, ExternalLink, CheckCircle, Clock, Target, Zap, Lock, Crown
} from "lucide-react";
import { createChart, IChartApi, CandlestickSeries, ISeriesApi, ColorType, CrosshairMode } from "lightweight-charts";
import type { Candlestick, Signal } from "@/lib/deriv";
import { initDerivClient, getDerivState, predictSpike, getCandlesticks } from "@/lib/deriv";
import type { IndexType } from "@/lib/deriv";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

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

interface OBLevel {
  price: number;
  type: "bullish" | "bearish";
  strength: number;
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
  orderBlocks: OBLevel[];
  upScore: number;
  downScore: number;
  connected: boolean;
  signal: Signal;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  isConfirmed: boolean;
  confirmationPrice: number | null;
}

const INDICES: { type: IndexType; number: number; icon: any; color: string; label: string; symbol: string }[] = [
  { type: "BOOM", number: 500, icon: Flame, color: "#22c55e", label: "Boom 500", symbol: "BOOM500" },
  { type: "BOOM", number: 900, icon: Flame, color: "#16a34a", label: "Boom 900", symbol: "BOOM900" },
  { type: "BOOM", number: 1000, icon: Flame, color: "#15803d", label: "Boom 1000", symbol: "BOOM1000" },
  { type: "CRASH", number: 500, icon: Droplet, color: "#fb7185", label: "Crash 500", symbol: "CRASH500" },
  { type: "CRASH", number: 900, icon: Droplet, color: "#f43f5e", label: "Crash 900", symbol: "CRASH900" },
  { type: "CRASH", number: 1000, icon: Droplet, color: "#be123c", label: "Crash 1000", symbol: "CRASH1000" },
];

const DERIV_URL = "https://app.deriv.com/trading";

function SignalBadge({ signal, isConfirmed }: { signal: Signal; isConfirmed: boolean }) {
  if (signal === "NEUTRAL") return null;

  const isBuy = signal === "BUY" || signal === "STRONG_BUY";
  const isStrong = signal === "STRONG_BUY" || signal === "STRONG_SELL";
  const colors = isBuy
    ? "border-success/40 bg-success/15 text-success"
    : "border-danger/40 bg-danger/15 text-danger";
  const icon = isBuy ? <TrendingUp size={16} /> : <TrendingDown size={16} />;
  const label = isBuy ? "ACHAT" : "VENTE";
  const strength = isStrong ? "FORT" : "MODÉRÉ";

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colors} ${isConfirmed ? "animate-pulse" : ""}`}>
      {isConfirmed ? <Zap size={14} /> : <Clock size={14} />}
      <span className="font-bold text-sm">{label}</span>
      <span className="text-[10px] opacity-70">({strength})</span>
    </div>
  );
}

export default function PredictionGame() {
  const { user } = useAuth();
  const router = useRouter();

  const [state, setState] = useState<Record<string, IndexData> | null>(null);
  const [spike, setSpike] = useState<SpikePrediction | null>(null);
  const [activeKey, setActiveKey] = useState("BOOM_500");
  const [connected, setConnected] = useState(false);
  const [candles, setCandles] = useState<Candlestick[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [signalUsage, setSignalUsage] = useState({ used: 0, limit: 3, remaining: 3 });

  useEffect(() => {
    if (!user) return;
    apiFetch<any>("/subscription/status").then(d => setIsPremium(d.isPremium)).catch(() => {});
    apiFetch<any>("/subscription/signal-usage").then(d => setSignalUsage(d)).catch(() => {});
  }, [user]);

  const chartRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick", any> | null>(null);

  const activeIdx = INDICES.find((i) => `${i.type}_${i.number}` === activeKey);
  const price = state?.[activeKey]?.price ?? 0;
  const change = state?.[activeKey]?.change24h ?? 0;

  const fetchState = useCallback(() => {
    try {
      const derivState = getDerivState();
      const isConnected = derivState.source === "deriv-live";
      setConnected(isConnected);
      if (isConnected) {
        setState(derivState as unknown as Record<string, IndexData>);
        const parts = activeKey.split("_");
        const type = parts[0] as IndexType;
        const num = parseInt(parts[1]);
        const pred = predictSpike(type, num);
        if (pred && !("error" in pred)) {
          setSpike(pred as unknown as SpikePrediction);
        }
        const candlestickData = getCandlesticks(type, num);
        setCandles([...candlestickData]);
      }
    } catch { /* ignore */ }
  }, [activeKey]);

  useEffect(() => {
    initDerivClient();
    fetchState();
    const interval = setInterval(fetchState, 1000);
    return () => clearInterval(interval);
  }, [fetchState]);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a0aec0",
      },
      grid: {
        vertLines: { color: "#2d3748" },
        horzLines: { color: "#2d3748" },
      },
      width: chartRef.current.clientWidth,
      height: 320,
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: {
        borderColor: "#2d3748",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: { borderColor: "#2d3748" },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartApiRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartApiRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (seriesRef.current && candles.length > 0) {
      seriesRef.current.setData(candles.map(c => ({
        time: c.time as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })));
    }
  }, [candles]);

  useEffect(() => {
    if (chartApiRef.current && chartRef.current) {
      chartApiRef.current.applyOptions({ width: chartRef.current.clientWidth });
    }
  }, [activeKey]);

  const hasSignal = spike?.signal && spike.signal !== "NEUTRAL";

  return (
    <section className="py-20 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 flex items-center justify-center gap-3">
            <Zap className="text-primary" size={32} />
            Signaux Trading en Direct
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            L&apos;algorithme analyse les niveaux S/R et ordres blocs pour générer des signaux BUY/SELL avec entrée, stop loss et take profit.
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-2">
            {INDICES.map((idx) => {
              const key = `${idx.type}_${idx.number}`;
              const isActive = key === activeKey;
              const idxSpike = state?.[key]
                ? predictSpike(idx.type, idx.number) as unknown as SpikePrediction | null
                : null;
              const hasIdxSignal = idxSpike && idxSpike.signal && idxSpike.signal !== "NEUTRAL";
              return (
                <button key={key} onClick={() => { setActiveKey(key); setSpike(null); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-surface border border-primary/40 text-text" : "bg-background border border-border text-text-secondary hover:bg-surface hover:border-border"}`}>
                  <idx.icon size={18} style={{ color: idx.color }} />
                  <span>{idx.label}</span>
                  <div className="ml-auto flex items-center gap-2">
                    {hasIdxSignal && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${idxSpike!.expectedDirection === "up" ? "bg-success/20 text-success" : "bg-danger/20 text-danger"}`}>
                        {idxSpike!.expectedDirection === "up" ? "BUY" : "SELL"}
                      </span>
                    )}
                    {state?.[key] && (
                      <span className={`text-xs font-mono ${(state[key].change24h ?? 0) >= 0 ? "text-success" : "text-danger"}`}>
                        {(state[key].change24h ?? 0) >= 0 ? "+" : ""}{(state[key].change24h ?? 0).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {activeIdx && <activeIdx.icon size={20} style={{ color: activeIdx.color }} />}
                  <span className="font-semibold">{activeIdx?.label ?? "Select"}</span>
                  {hasSignal && spike && <SignalBadge signal={spike.signal} isConfirmed={spike.isConfirmed} />}
                </div>
                <div className="flex items-center gap-3">
                  <a href={`${DERIV_URL}?symbol=${activeIdx?.symbol}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all">
                    <ExternalLink size={12} /> Deriv
                  </a>
                  <span className={`text-xs font-mono ${change >= 0 ? "text-success" : "text-danger"}`}>
                    {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="text-2xl font-bold font-mono">
                  ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {!connected && <span className="text-xs text-text-muted font-normal ml-2">(déconnecté)</span>}
                </div>
              </div>

              <div ref={chartRef} className="w-full" />
            </div>

            {hasSignal && spike && (
              <div className={`rounded-xl border p-5 transition-all relative overflow-hidden ${spike.isConfirmed ? "border-success/50 bg-success/10" : spike.signal.includes("STRONG") ? "border-primary/40 bg-primary/10" : "border-border bg-surface/50"}`}>
                {!isPremium && !user && (
                  <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-6">
                    <Lock size={32} className="text-text-muted" />
                    <p className="font-semibold text-text">Signal réservé aux membres</p>
                    <p className="text-xs text-text-secondary text-center">Connecte-toi pour voir les signaux</p>
                    <a href="/connexion" className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">Se connecter</a>
                  </div>
                )}
                {!isPremium && user && (
                  <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-6">
                    <Crown size={32} className="text-warning" />
                    <p className="font-semibold text-text">Signal Premium</p>
                    <p className="text-xs text-text-secondary text-center">
                      {signalUsage.remaining > 0
                        ? `Il te reste ${signalUsage.remaining} signal${signalUsage.remaining > 1 ? 'x' : ''} gratuit aujourd'hui sur 4`
                        : "Abonne-toi pour voir les signaux en temps réel"}
                    </p>
                    {signalUsage.remaining > 0 ? (
                      <span className="bg-primary/20 text-primary px-4 py-1.5 rounded-lg text-xs font-semibold">
                        {signalUsage.remaining}/{4} gratuit{signalUsage.remaining > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <a href="/recompenses" className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                        Premium — 10 $/mois
                      </a>
                    )}
                  </div>
                )}
                <div className={`${!isPremium ? "opacity-30 blur-sm pointer-events-none" : ""}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {spike.isConfirmed ? (
                        <CheckCircle size={20} className="text-success" />
                      ) : (
                        <Clock size={20} className="text-warning" />
                      )}
                      <span className="font-semibold">
                        Signal {spike.expectedDirection === "up" ? "ACHAT" : "VENTE"}
                        {spike.isConfirmed ? " ✓ Confirmé" : " — En attente de confirmation"}
                      </span>
                    </div>
                    <span className={`text-lg font-bold font-mono ${spike.spikeProbability >= 70 ? "text-success" : spike.spikeProbability >= 50 ? "text-warning" : "text-text-muted"}`}>
                      {spike.spikeProbability}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="rounded-lg bg-background border border-border p-3">
                      <p className="text-[10px] text-text-muted uppercase font-semibold mb-1 flex items-center gap-1">
                        <Target size={10} /> Point d&apos;entrée
                      </p>
                      <p className="text-lg font-bold font-mono text-text">${spike.entryPrice.toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg bg-background border border-border p-3">
                      <p className="text-[10px] text-text-muted uppercase font-semibold mb-1">Stop Loss</p>
                      <p className={`text-lg font-bold font-mono ${spike.expectedDirection === "up" ? "text-danger" : "text-success"}`}>
                        ${spike.stopLoss.toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-background border border-border p-3">
                      <p className="text-[10px] text-text-muted uppercase font-semibold mb-1">Take Profit</p>
                      <p className={`text-lg font-bold font-mono ${spike.expectedDirection === "up" ? "text-success" : "text-danger"}`}>
                        ${spike.takeProfit.toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-background border border-border p-3">
                      <p className="text-[10px] text-text-muted uppercase font-semibold mb-1">Ampleur estimée</p>
                      <p className="text-lg font-bold font-mono text-text">{spike.estimatedMagnitude}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-text-secondary bg-background rounded-lg px-3 py-2 border border-border">
                    <BarChart3 size={12} className="text-primary" />
                    <span>
                      {spike.expectedDirection === "up"
                        ? `Prix proche du support (${spike.referenceStrength}x touché), ${spike.consecutiveMoves} baisses consécutives, OB haussier → Signal ACHAT`
                        : `Prix proche de la résistance (${spike.referenceStrength}x touchée), ${spike.consecutiveMoves} hausses consécutives, OB baissier → Signal VENTE`}
                    </span>
                  </div>

                  {spike.isConfirmed && (
                    <div className="mt-3 flex items-center gap-2 text-success animate-pulse text-sm font-semibold">
                      <Zap size={14} />
                      Signal confirmé à ${spike.confirmationPrice?.toFixed(2) ?? "—"} ! Position active.
                    </div>
                  )}

                  {!spike.isConfirmed && spike.signal !== "NEUTRAL" && (
                    <div className="mt-3 flex items-center gap-2 text-warning text-sm">
                      <Clock size={14} />
                      En attente de confirmation du mouvement dans la direction anticipée...
                    </div>
                  )}
                </div>
              </div>
            )}

            {spike && !hasSignal && (
              <div className="rounded-xl border border-border bg-surface/50 p-5 text-center">
                <BarChart3 size={24} className="mx-auto mb-2 text-text-muted" />
                <p className="text-text-muted text-sm">Analyse en cours — aucun signal clair pour le moment</p>
                <div className="flex justify-center gap-4 mt-3 text-xs text-text-secondary">
                  <span>Hausse: <strong className="text-success">{spike.upScore}%</strong></span>
                  <span>Baisse: <strong className="text-danger">{spike.downScore}%</strong></span>
                  <span>Probabilité: <strong>{spike.spikeProbability}%</strong></span>
                </div>
              </div>
            )}

            {!connected && (
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-center text-sm text-text-secondary">
                <AlertTriangle size={16} className="inline mr-2 text-warning" />
                Connexion WebSocket en cours...
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
