"use client";

import { useEffect, useState, useRef } from "react";
import {
  ResponsiveContainer, Area, AreaChart,
} from "recharts";
import {
  TrendingUp, AlertTriangle, Flame, Droplet,
  Maximize2, Minimize2, Pause, Play, Wifi, WifiOff,
} from "lucide-react";
import { createChart, IChartApi, CandlestickSeries, ISeriesApi, ColorType, CrosshairMode } from "lightweight-charts";
import { initDerivClient, getDerivState, predictSpike, getCandlesticks } from "@/lib/deriv";
import type { IndexType, Candlestick } from "@/lib/deriv";

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
  referenceLevel?: number;
  referenceStrength?: number;
  distancePercent?: number;
  consecutiveMoves?: number;
  sRlevels?: SRLevel[];
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  signal?: string;
  error?: string;
}

const INDICES = [
  { type: "BOOM" as IndexType, number: 500, label: "Boom 500", color: "#22c55e" },
  { type: "BOOM" as IndexType, number: 900, label: "Boom 900", color: "#16a34a" },
  { type: "BOOM" as IndexType, number: 1000, label: "Boom 1000", color: "#15803d" },
  { type: "CRASH" as IndexType, number: 500, label: "Crash 500", color: "#fb7185" },
  { type: "CRASH" as IndexType, number: 900, label: "Crash 900", color: "#f43f5e" },
  { type: "CRASH" as IndexType, number: 1000, label: "Crash 1000", color: "#be123c" },
];

function MiniChart({ data, color }: { data: number[]; color: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const chartData = data.map((v, i) => ({ i, v }));

  return (
    <ResponsiveContainer width="100%" height={60}>
      <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#grad-${color.replace("#", "")})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function CandleChart({ candles, color }: { candles: Candlestick[]; color: string }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick", any> | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartApiRef.current) {
      chartApiRef.current.applyOptions({ width: chartRef.current.clientWidth, height: 300 });
      return;
    }
    const chart = createChart(chartRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#a0aec0" },
      grid: { vertLines: { color: "#2d3748" }, horzLines: { color: "#2d3748" } },
      width: chartRef.current.clientWidth, height: 300,
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
  }, []);

  useEffect(() => {
    if (seriesRef.current && candles.length > 0) {
      seriesRef.current.setData(candles.map(c => ({ time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close })));
    }
  }, [candles]);

  return <div ref={chartRef} className="w-full" style={{ height: 300 }} />;
}

export default function DerivChart() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const pausedRef = useRef(paused);
  const [renderTick, setRenderTick] = useState(0);
  const [candles, setCandles] = useState<Candlestick[]>([]);

  pausedRef.current = paused;

  useEffect(() => { initDerivClient(); }, []);

  useEffect(() => {
    if (pausedRef.current) return;
    const interval = setInterval(() => setRenderTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const parts = expanded.split("_");
    const type = parts[0] as IndexType;
    const num = parseInt(parts[1]);
    const interval = setInterval(() => {
      setCandles([...getCandlesticks(type, num)]);
    }, 1000);
    return () => clearInterval(interval);
  }, [expanded]);

  const derivState = getDerivState();
  const source = derivState.source;
  const connected = source === "deriv-live";

  const getIdx = (key: string) => INDICES.find(i => `${i.type}_${i.number}` === key);

  const currentPrice = (key: string) => {
    const label = key.toLowerCase();
    return (derivState as any)[label]?.price ?? 0;
  };
  const currentChange = (key: string) => {
    const label = key.toLowerCase();
    return (derivState as any)[label]?.change24h ?? 0;
  };
  const currentHistory = (key: string): number[] => {
    const label = key.toLowerCase();
    return (derivState as any)[label]?.history ?? [];
  };
  const idxConnected = (key: string): boolean => {
    const label = key.toLowerCase();
    return (derivState as any)[label]?.connected ?? false;
  };
  const anyConnected = INDICES.some(i => idxConnected(`${i.type}_${i.number}`));

  const getPrediction = (key: string): SpikePrediction | null => {
    const idx = getIdx(key);
    if (!idx) return null;
    const pred = predictSpike(idx.type, idx.number);
    if (!pred || "error" in pred) return null;
    return pred as SpikePrediction;
  };

  const expandedPrediction = expanded ? getPrediction(expanded) : null;

  if (!derivState) {
    return (
      <section className="py-20 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-surface-light rounded w-64" />
            <div className="h-4 bg-surface-light rounded w-96" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-surface-light rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="deriv" className="py-20 px-4 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
                <TrendingUp className="text-primary" size={32} />
                Indices Synthétiques Deriv
              </h2>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${anyConnected ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
                {anyConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                {anyConnected ? "Live" : "Déconnecté"}
              </div>
            </div>
            <p className="text-text-secondary mt-2">Boom & Crash — API Deriv (WebSocket) en temps réel</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaused(!paused)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${paused ? "bg-warning/20 text-warning border border-warning/30" : "bg-surface border border-border text-text-secondary hover:text-text"}`}
            >
              {paused ? <Play size={14} /> : <Pause size={14} />}
              {paused ? "Reprendre" : "Pause"}
            </button>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "grid" ? "bg-primary text-white" : "bg-surface text-text-secondary hover:text-text"}`}
              >Grille</button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-primary text-white" : "bg-surface text-text-secondary hover:text-text"}`}
              >Liste</button>
            </div>
          </div>
        </div>

        {!connected && (
          <div className="mb-6 p-4 rounded-xl border border-border bg-surface/50">
            <p className="text-sm text-text-secondary flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
              Connexion à l&apos;API Deriv en cours...
            </p>
          </div>
        )}

        {expanded && currentHistory(expanded).length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {expanded.startsWith("BOOM") ? <Flame size={24} className="text-success" /> : <Droplet size={24} className="text-danger" />}
                <div>
                  <h3 className="font-bold text-lg">{getIdx(expanded)?.label}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-2xl font-bold font-mono">${currentPrice(expanded).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span className={`text-sm font-mono ${currentChange(expanded) >= 0 ? "text-success" : "text-danger"}`}>
                      {currentChange(expanded) >= 0 ? "+" : ""}{currentChange(expanded).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setExpanded(null)} className="p-2 hover:bg-surface-light rounded-lg transition-colors">
                <Minimize2 size={18} className="text-text-muted" />
              </button>
            </div>
            <CandleChart candles={candles} color={expanded.startsWith("BOOM") ? "#22c55e" : "#fb7185"} />
            {expandedPrediction && (
              <div className={`mt-4 p-4 rounded-xl border ${expandedPrediction.isSpikeImminent ? "border-red-500/40 bg-red-500/10" : "bg-background border-border"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {expanded.startsWith("BOOM") ? <Flame size={16} className="text-success" /> : <Droplet size={16} className="text-danger" />}
                    <span className="font-bold text-sm">
                      {getIdx(expanded)?.label} — Analyse Algorithmique
                    </span>
                  </div>
                  <span className={`font-bold font-mono text-lg ${expandedPrediction.isSpikeImminent ? "text-danger" : expandedPrediction.spikeProbability > 50 ? "text-warning" : "text-success"}`}>
                    {expandedPrediction.spikeProbability}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-surface-light rounded-full mt-2 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${expandedPrediction.spikeProbability}%`, background: expandedPrediction.isSpikeImminent ? "#ef4444" : expandedPrediction.spikeProbability > 50 ? "#f59e0b" : "#22c55e" }} />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3 text-xs text-text-secondary">
                  <div className={`rounded-lg border p-2.5 ${expandedPrediction.expectedDirection === "up" ? "bg-success/5 border-success/20" : "bg-surface-light border-border"}`}>
                    <div className="text-text-muted text-[10px] uppercase font-semibold">Hausse (support)</div>
                    <div className="font-bold font-mono text-success">{expandedPrediction.spikeProbability}%</div>
                    <div className="text-[9px] text-text-muted mt-0.5">
                      {expanded.startsWith("BOOM") ? "Proche du support → rebond probable" : "Éloigné de la résistance"}
                    </div>
                  </div>
                  <div className={`rounded-lg border p-2.5 ${expandedPrediction.expectedDirection === "down" ? "bg-danger/5 border-danger/20" : "bg-surface-light border-border"}`}>
                    <div className="text-text-muted text-[10px] uppercase font-semibold">Baisse (résistance)</div>
                    <div className="font-bold font-mono text-danger">{Math.round(expandedPrediction.spikeProbability * (expanded.startsWith("CRASH") ? 0.85 : 0.4))}%</div>
                    <div className="text-[9px] text-text-muted mt-0.5">
                      {expanded.startsWith("CRASH") ? "Proche de la résistance → retournement probable" : "Support solide en dessous"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="rounded-lg bg-success/5 border border-success/20 p-2.5 text-center">
                    <p className="text-[9px] text-text-muted uppercase font-semibold">Entrée</p>
                    <p className="font-bold font-mono text-xs text-text mt-0.5">
                      ${expandedPrediction.entryPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-danger/5 border border-danger/20 p-2.5 text-center">
                    <p className="text-[9px] text-text-muted uppercase font-semibold">Stop Loss</p>
                    <p className="font-bold font-mono text-xs text-danger mt-0.5">
                      ${expandedPrediction.stopLoss?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-success/5 border border-success/20 p-2.5 text-center">
                    <p className="text-[9px] text-text-muted uppercase font-semibold">Take Profit</p>
                    <p className="font-bold font-mono text-xs text-success mt-0.5">
                      ${expandedPrediction.takeProfit?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 p-2.5 rounded-lg bg-surface-light/50 border border-border text-[10px] text-text-secondary leading-relaxed">
                  <span className="font-semibold text-text-muted">Raisonnement : </span>
                  {expandedPrediction.consecutiveMoves !== undefined && (
                    <>{expandedPrediction.consecutiveMoves} mouvements consécutifs opposés • </>
                  )}
                  Distance du niveau S/R : {expandedPrediction.distancePercent ?? 0}% • 
                  Force S/R : {expandedPrediction.referenceStrength ?? 0} touches • 
                  Dernier spike il y a {expandedPrediction.timeSinceLastSpike}s
                </div>

                {expandedPrediction.sRlevels && expandedPrediction.sRlevels.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[10px] font-semibold text-text-muted uppercase mb-1.5">Niveaux S/R détectés</div>
                    <div className="flex flex-wrap gap-1.5">
                      {expandedPrediction.sRlevels.map((level: SRLevel, i: number) => (
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
              </div>
            )}
          </div>
        )}

        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
          {INDICES.map((idx) => {
            const key = `${idx.type}_${idx.number}`;
            const price = currentPrice(key);
            const change = currentChange(key);
            const isExpanded = expanded === key;
            const spike = getPrediction(key);
            const conn = idxConnected(key);

            return (
              <div
                key={key}
                className={`rounded-xl border transition-all cursor-pointer hover:border-primary/30 ${isExpanded ? "border-primary/40 bg-surface" : "bg-surface/50 border-border"}`}
                onClick={() => !isExpanded && currentHistory(key).length > 0 && setExpanded(key)}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {idx.type === "BOOM" ? <Flame size={16} style={{ color: idx.color }} /> : <Droplet size={16} style={{ color: idx.color }} />}
                      <span className="font-semibold text-sm">{idx.label}</span>
                      {conn && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
                    </div>
                    <div className="flex items-center gap-2">
                      {spike?.isSpikeImminent && <AlertTriangle size={14} className="text-danger animate-pulse" />}
                      <span className={`text-xs font-mono ${change >= 0 ? "text-success" : "text-danger"}`}>
                        {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-xl font-bold font-mono mb-2">
                    {price > 0
                      ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : <span className="text-text-muted text-sm">En attente...</span>}
                  </div>
                  {currentHistory(key).length > 1 ? (
                    <MiniChart data={currentHistory(key)} color={idx.color} />
                  ) : (
                    <div className="h-[60px] flex items-center justify-center text-text-muted text-xs">Données en attente...</div>
                  )}
                  {spike && (
                    <div className="mt-2 flex items-center gap-2 text-[10px]">
                      <div className="flex-1 h-1 rounded-full bg-surface-light overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${spike.spikeProbability}%`, background: spike.isSpikeImminent ? "#ef4444" : "#f59e0b" }} />
                      </div>
                      <span className="font-mono font-semibold" style={{ color: spike.isSpikeImminent ? "#ef4444" : "#f59e0b" }}>{spike.spikeProbability}%</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-surface/50 p-4">
            <h4 className="text-xs font-semibold text-text-muted uppercase mb-2">Boom</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              Les indices <strong className="text-success">Boom</strong> génèrent des spikes à la <strong className="text-success">hausse</strong>. Plus le numéro est bas (500), plus la volatilité est élevée.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface/50 p-4">
            <h4 className="text-xs font-semibold text-text-muted uppercase mb-2">Crash</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              Les indices <strong className="text-danger">Crash</strong> génèrent des spikes à la <strong className="text-danger">baisse</strong>. Le 500 est le plus volatil, le 1000 le plus stable.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface/50 p-4">
            <h4 className="text-xs font-semibold text-text-muted uppercase mb-2">Source</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              Données live via l&apos;API WebSocket Deriv. {connected ? "Connecté et en réception." : "Tentative de connexion..."}
            </p>
          </div>
        </div>

        <p className="text-xs text-text-muted mt-4 text-center">
          API Deriv (WebSocket) • 6 indices synthétiques • Mise à jour chaque seconde
        </p>
      </div>
    </section>
  );
}
