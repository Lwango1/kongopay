"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Brain, TrendingUp, TrendingDown, Flame, Droplet, AlertTriangle, BarChart3,
  ExternalLink, CheckCircle, Clock, Target, Zap, Lock, Crown, Wifi, WifiOff,
} from "lucide-react";
import { createChart, IChartApi, CandlestickSeries, ISeriesApi, ColorType, CrosshairMode } from "lightweight-charts";
import type { Candlestick, Signal } from "@/lib/deriv";
import { initDerivClient, getDerivState, predictSpike, getCandlesticks } from "@/lib/deriv";

interface SRLevel {
  price: number;
  strength: number;
  type: "support" | "resistance";
}
import type { IndexType } from "@/lib/deriv";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

interface IndexInfo {
  type: IndexType; number: number; icon: any; color: string; label: string; symbol: string;
}

interface DetectedSignal {
  key: string;
  index: IndexInfo;
  direction: string;
  probability: number;
  signal: Signal;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  magnitude: string;
  timeSinceSpike: number;
  detectedAt: number;
  upScore?: number;
  downScore?: number;
  consecutiveMoves?: number;
  distancePercent?: number;
  referenceStrength?: number;
  sRlevels?: SRLevel[];
  referenceLevel?: number;
}

const INDICES: IndexInfo[] = [
  { type: "BOOM", number: 500, icon: Flame, color: "#22c55e", label: "Boom 500", symbol: "BOOM500" },
  { type: "BOOM", number: 900, icon: Flame, color: "#16a34a", label: "Boom 900", symbol: "BOOM900" },
  { type: "BOOM", number: 1000, icon: Flame, color: "#15803d", label: "Boom 1000", symbol: "BOOM1000" },
  { type: "CRASH", number: 500, icon: Droplet, color: "#fb7185", label: "Crash 500", symbol: "CRASH500" },
  { type: "CRASH", number: 900, icon: Droplet, color: "#f43f5e", label: "Crash 900", symbol: "CRASH900" },
  { type: "CRASH", number: 1000, icon: Droplet, color: "#be123c", label: "Crash 1000", symbol: "CRASH1000" },
];

const DERIV_URL = "https://app.deriv.com/trading";
const SIGNAL_EXPIRY_MS = 5 * 60 * 1000;
const MIN_PROBABILITY = 75;

export default function PredictionGame() {
  const { user } = useAuth();
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [activeSignals, setActiveSignals] = useState<DetectedSignal[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<string | null>(null);
  const [candles, setCandles] = useState<Candlestick[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [signalUsage, setSignalUsage] = useState({ used: 0, limit: 3, remaining: 3 });

  const chartRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick", any> | null>(null);
  const prevKeysRef = useRef<string>("");

  useEffect(() => {
    if (!user) return;
    apiFetch<any>("/subscription/status").then(d => setIsPremium(d.isPremium)).catch(() => {});
    apiFetch<any>("/subscription/signal-usage").then(d => setSignalUsage(d)).catch(() => {});
  }, [user]);

  const selectedIdx = selectedSignal
    ? INDICES.find(i => `${i.type}_${i.number}` === selectedSignal)
    : null;

  const scanAll = useCallback(() => {
    try {
      const derivState = getDerivState();
      const isLive = derivState.source === "deriv-live";
      setConnected(isLive);
      if (!isLive) return;

      const now = Date.now();
      const newSignals: DetectedSignal[] = [];
      const seen = new Set<string>();

      for (const idx of INDICES) {
        const k = `${idx.type}_${idx.number}`;
        const raw = predictSpike(idx.type, idx.number);
        if (!raw || "error" in raw) continue;
        const p = raw as any;
        if (!p.isSpikeImminent || p.spikeProbability < MIN_PROBABILITY) continue;

        seen.add(k);
        newSignals.push({
          key: k, index: idx,
          direction: p.expectedDirection,
          probability: p.spikeProbability ?? 0,
          signal: p.signal ?? (p.spikeProbability > 50 ? "BUY" : "SELL"),
          entryPrice: p.entryPrice ?? p.currentPrice ?? 0,
          stopLoss: p.stopLoss ?? 0,
          takeProfit: p.takeProfit ?? 0,
          magnitude: p.estimatedMagnitude ?? "0%",
          timeSinceSpike: p.timeSinceSpike ?? 0,
          detectedAt: now,
          upScore: p.upScore,
          downScore: p.downScore,
          consecutiveMoves: p.consecutiveMoves,
          distancePercent: p.distancePercent,
          referenceStrength: p.referenceStrength,
          sRlevels: p.sRlevels,
          referenceLevel: p.referenceLevel,
        });

        if (!selectedSignal) setSelectedSignal(k);
      }

      setActiveSignals(prev => {
        const merged = [...prev.filter(s => !seen.has(s.key) && now - s.detectedAt < SIGNAL_EXPIRY_MS)];
        for (const ns of newSignals) {
          if (!merged.find(s => s.key === ns.key)) merged.push(ns);
        }
        merged.sort((a, b) => b.probability - a.probability);
        return merged;
      });
    } catch { /* ignore */ }
  }, [selectedSignal]);

  useEffect(() => {
    initDerivClient();
    scanAll();
    const interval = setInterval(scanAll, 1000);
    return () => clearInterval(interval);
  }, [scanAll]);

  useEffect(() => {
    if (!selectedSignal) return;
    const parts = selectedSignal.split("_");
    const type = parts[0] as IndexType;
    const num = parseInt(parts[1]);
    const interval = setInterval(() => {
      const cd = getCandlesticks(type, num);
      setCandles([...cd]);
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedSignal]);

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartApiRef.current) {
      chartApiRef.current.applyOptions({ width: chartRef.current.clientWidth, height: 260 });
      return;
    }
    const chart = createChart(chartRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#a0aec0" },
      grid: { vertLines: { color: "#2d3748" }, horzLines: { color: "#2d3748" } },
      width: chartRef.current.clientWidth, height: 260,
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { borderColor: "#2d3748", timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: "#2d3748" },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e", downColor: "#ef4444",
      borderUpColor: "#22c55e", borderDownColor: "#ef4444",
      wickUpColor: "#22c55e", wickDownColor: "#ef4444",
    });
    chartApiRef.current = chart;
    seriesRef.current = series;
    const handleResize = () => { if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth }); };
    window.addEventListener("resize", handleResize);
    return () => { window.removeEventListener("resize", handleResize); chart.remove(); chartApiRef.current = null; seriesRef.current = null; };
  }, [selectedSignal]);

  useEffect(() => {
    if (seriesRef.current && candles.length > 0) {
      seriesRef.current.setData(candles.map(c => ({ time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close })));
    }
  }, [candles]);

  const hasAccess = isPremium || (user && signalUsage.remaining > 0) || false;
  const signal = activeSignals.find(s => s.key === selectedSignal);

  return (
    <section className="py-20 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 flex items-center justify-center gap-3">
            <Zap className="text-primary" size={32} />
            Signaux Trading en Direct
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            Scan automatique des 6 indices synthétiques. Les signaux apparaissent
            quand une opportunité de spike est détectée.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 mb-8">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${connected ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? "Live" : "Déconnecté"}
          </div>
          {activeSignals.length > 0 && (
            <span className="text-xs text-text-muted">
              {activeSignals.length} signal{activeSignals.length > 1 ? "x" : ""} actif{activeSignals.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {connected && activeSignals.length === 0 && (
          <div className="text-center py-16">
            <Brain size={40} className="mx-auto mb-4 text-text-muted" />
            <p className="text-text-secondary text-sm">
              Scan des 6 indices en temps réel...
            </p>
            <p className="text-text-muted text-xs mt-2">
              Aucune opportunité détectée pour le moment. Les signaux apparaîtront automatiquement.
            </p>
          </div>
        )}

        {!connected && (
          <div className="text-center py-16">
            <AlertTriangle size={40} className="mx-auto mb-4 text-warning" />
            <p className="text-text-secondary text-sm">Connexion WebSocket en cours...</p>
          </div>
        )}

        {activeSignals.length > 0 && (
          <div className="grid lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 space-y-2">
              {activeSignals.map((s) => {
                const isSel = s.key === selectedSignal;
                const timeLeft = Math.max(0, SIGNAL_EXPIRY_MS - (Date.now() - s.detectedAt));
                return (
                  <button key={s.key} onClick={() => setSelectedSignal(s.key)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all ${isSel ? "bg-surface border border-primary/40 text-text" : "bg-background border border-border text-text-secondary hover:bg-surface"}`}>
                    <s.index.icon size={18} style={{ color: s.index.color }} />
                    <div className="flex-1 text-left">
                      <span className="font-semibold">{s.index.label}</span>
                      <div className={`text-xs font-medium mt-0.5 ${s.direction === "up" ? "text-success" : "text-danger"}`}>
                        {s.direction === "up" ? "↑ ACHAT" : "↓ VENTE"} — {s.probability}%
                      </div>
                    </div>
                    <span className="text-[10px] text-text-muted">{Math.ceil(timeLeft / 60000)}m</span>
                  </button>
                );
              })}
            </div>

            <div className="lg:col-span-3 space-y-4">
              {signal && (
                <>
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <signal.index.icon size={20} style={{ color: signal.index.color }} />
                        <span className="font-semibold">{signal.index.label}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${signal.direction === "up" ? "bg-success/15 text-success border border-success/30" : "bg-danger/15 text-danger border border-danger/30"}`}>
                          {signal.direction === "up" ? "ACHAT" : "VENTE"}
                        </span>
                      </div>
                      <a href={`${DERIV_URL}?symbol=${signal.index.symbol}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all">
                        <ExternalLink size={12} /> Deriv
                      </a>
                    </div>
                    <div ref={chartRef} className="w-full" />
                  </div>

                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-sm flex items-center gap-2">
                        <Zap size={16} className="text-primary" />
                        {signal.index.label} — Analyse Algorithmique
                      </span>
                      <span className={`font-bold font-mono text-lg ${signal.probability >= 85 ? "text-danger" : "text-warning"}`}>
                        {signal.probability}%
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-surface-light rounded-full mb-4 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${signal.probability}%`, background: signal.probability >= 85 ? "#ef4444" : "#f59e0b" }} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4 text-xs text-text-secondary">
                      <div className={`rounded-lg border p-2.5 ${signal.direction === "up" ? "bg-success/5 border-success/20" : "bg-surface-light border-border"}`}>
                        <div className="text-text-muted text-[10px] uppercase font-semibold">Hausse (support)</div>
                        <div className="font-bold font-mono text-success">{signal.upScore ?? signal.probability}%</div>
                        <div className="text-[9px] text-text-muted mt-0.5">
                          {signal.index.type === "BOOM" ? "Proche du support → rebond probable" : "Éloigné de la résistance"}
                        </div>
                      </div>
                      <div className={`rounded-lg border p-2.5 ${signal.direction === "down" ? "bg-danger/5 border-danger/20" : "bg-surface-light border-border"}`}>
                        <div className="text-text-muted text-[10px] uppercase font-semibold">Baisse (résistance)</div>
                        <div className="font-bold font-mono text-danger">{signal.downScore ?? Math.round(signal.probability * 0.4)}%</div>
                        <div className="text-[9px] text-text-muted mt-0.5">
                          {signal.index.type === "CRASH" ? "Proche de la résistance → retournement probable" : "Support solide en dessous"}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                      <div className="rounded-lg bg-background border border-border p-2.5 text-center">
                        <p className="text-[9px] text-text-muted uppercase font-semibold">Entrée</p>
                        <p className="font-bold font-mono text-xs text-text mt-0.5">${signal.entryPrice.toFixed(2)}</p>
                      </div>
                      <div className="rounded-lg bg-background border border-border p-2.5 text-center">
                        <p className="text-[9px] text-text-muted uppercase font-semibold">Stop Loss</p>
                        <p className={`font-bold font-mono text-xs mt-0.5 ${signal.direction === "up" ? "text-danger" : "text-success"}`}>${signal.stopLoss.toFixed(2)}</p>
                      </div>
                      <div className="rounded-lg bg-background border border-border p-2.5 text-center">
                        <p className="text-[9px] text-text-muted uppercase font-semibold">Take Profit</p>
                        <p className={`font-bold font-mono text-xs mt-0.5 ${signal.direction === "up" ? "text-success" : "text-danger"}`}>${signal.takeProfit.toFixed(2)}</p>
                      </div>
                      <div className="rounded-lg bg-background border border-border p-2.5 text-center">
                        <p className="text-[9px] text-text-muted uppercase font-semibold">Ampleur</p>
                        <p className="font-bold font-mono text-xs text-text mt-0.5">{signal.magnitude}</p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-surface-light/50 border border-border text-[10px] text-text-secondary leading-relaxed mb-3">
                      <span className="font-semibold text-text-muted">Raisonnement : </span>
                      {signal.consecutiveMoves !== undefined && (
                        <>{signal.consecutiveMoves} mouvements consécutifs opposés • </>
                      )}
                      Distance du niveau S/R : {signal.distancePercent ?? 0}% • 
                      Force S/R : {signal.referenceStrength ?? 0} touches • 
                      Dernier spike il y a {signal.timeSinceSpike}s
                    </div>

                    {signal.sRlevels && signal.sRlevels.length > 0 && (
                      <div className="mb-3">
                        <div className="text-[10px] font-semibold text-text-muted uppercase mb-1.5">Niveaux S/R détectés</div>
                        <div className="flex flex-wrap gap-1.5">
                          {signal.sRlevels.map((level, i) => (
                            <span key={i}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium
                                ${level.type === "support"
                                  ? "bg-success/10 text-success border border-success/20"
                                  : "bg-danger/10 text-danger border border-danger/20"}`}
                            >
                              <span className={`w-1 h-1 rounded-full ${level.type === "support" ? "bg-success" : "bg-danger"}`} />
                              ${level.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                              <span className="opacity-60">x{level.strength}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs text-text-secondary bg-background rounded-lg px-3 py-2 border border-border">
                      <BarChart3 size={12} className="text-primary" />
                      <span>Signal détecté il y a {Math.round((Date.now() - signal.detectedAt) / 1000)}s sur {signal.index.label}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
