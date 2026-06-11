"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart, IChartApi, CandlestickSeries, LineSeries,
  ISeriesApi, ColorType,
} from "lightweight-charts";
import {
  Flame, Droplet,
  Maximize2, Minimize2, Wifi, WifiOff,
  BarChart3,
} from "lucide-react";
import { initDerivClient, getDerivState, predictSpike, getCandlesticksByTF } from "@/lib/deriv";
import type { IndexType, Candlestick } from "@/lib/deriv";
import { calculateRSI } from "@/lib/indicators";

type TimeFrame = "1m" | "5m" | "15m";

const TF_LABELS: Record<TimeFrame, string> = { "1m": "1 min", "5m": "5 min", "15m": "15 min" };

const INDICES = [
  { type: "BOOM" as IndexType, number: 500, label: "Boom 500", color: "#22c55e" },
  { type: "BOOM" as IndexType, number: 900, label: "Boom 900", color: "#16a34a" },
  { type: "BOOM" as IndexType, number: 1000, label: "Boom 1000", color: "#15803d" },
  { type: "CRASH" as IndexType, number: 500, label: "Crash 500", color: "#fb7185" },
  { type: "CRASH" as IndexType, number: 900, label: "Crash 900", color: "#f43f5e" },
  { type: "CRASH" as IndexType, number: 1000, label: "Crash 1000", color: "#be123c" },
];

function computeRSIData(candles: Candlestick[]): { time: number; value: number }[] {
  const prices = candles.map(c => c.close);
  const data: { time: number; value: number }[] = [];
  for (let i = 15; i < prices.length; i++) {
    const slice = prices.slice(0, i + 1);
    const val = calculateRSI(slice, 14);
    data.push({ time: candles[i].time, value: Math.round(val * 10) / 10 });
  }
  return data;
}



export default function DerivChart() {
  const [selectedSymbol, setSelectedSymbol] = useState("BOOM_500");
  const [timeframe, setTimeframe] = useState<TimeFrame>("1m");
  const [fullscreen, setFullscreen] = useState(false);
  const [renderTick, setRenderTick] = useState(0);

  const mainChartRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<HTMLDivElement>(null);

  const mainChartApi = useRef<IChartApi | null>(null);
  const rsiChartApi = useRef<IChartApi | null>(null);

  const candleSeries = useRef<ISeriesApi<"Candlestick", any> | null>(null);
  const rsiLineSeries = useRef<ISeriesApi<"Line", any> | null>(null);
  const rsiOverboughtSeries = useRef<ISeriesApi<"Line", any> | null>(null);
  const rsiOversoldSeries = useRef<ISeriesApi<"Line", any> | null>(null);

  const pausedRef = useRef(false);

  useEffect(() => { initDerivClient(); }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!pausedRef.current) setRenderTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const buildCharts = useCallback(() => {
    if (!mainChartRef.current) return;

    const mainHeight = fullscreen ? 400 : 280;
    const rsiHeight = fullscreen ? 120 : 80;

    if (mainChartApi.current) {
      mainChartApi.current.remove();
      mainChartApi.current = null;
    }
    if (rsiChartApi.current) {
      rsiChartApi.current.remove();
      rsiChartApi.current = null;
    }

    candleSeries.current = null;
    rsiLineSeries.current = null;
    rsiOverboughtSeries.current = null;
    rsiOversoldSeries.current = null;

    const sharedLayout = {
      background: { type: ColorType.Solid, color: "transparent" as const },
      textColor: "#a0aec0",
    };

    const sharedGrid = {
      vertLines: { color: "#2d3748" },
      horzLines: { color: "#2d3748" },
    };

    const sharedTimeScale = {
      borderColor: "#2d3748",
      timeVisible: true,
      secondsVisible: timeframe === "1m",
    };

    const mainChart = createChart(mainChartRef.current, {
      layout: sharedLayout,
      grid: sharedGrid,
      width: mainChartRef.current.clientWidth,
      height: mainHeight,
      crosshair: { mode: 0 },
      timeScale: { ...sharedTimeScale, visible: true },
      rightPriceScale: { borderColor: "#2d3748", scaleMargins: { top: 0.05, bottom: 0.15 } },
    });

    const candles = mainChart.addSeries(CandlestickSeries, {
      upColor: "#22c55e", downColor: "#ef4444",
      borderUpColor: "#22c55e", borderDownColor: "#ef4444",
      wickUpColor: "#22c55e", wickDownColor: "#ef4444",
    });
    candleSeries.current = candles;
    mainChartApi.current = mainChart;

    // RSI pane
    if (rsiChartRef.current) {
      const rsiChart = createChart(rsiChartRef.current, {
        layout: sharedLayout,
        grid: sharedGrid,
        width: mainChartRef.current.clientWidth,
        height: rsiHeight,
        crosshair: { mode: 0 },
        timeScale: { ...sharedTimeScale, visible: false },
        rightPriceScale: { borderColor: "#2d3748", scaleMargins: { top: 0.1, bottom: 0.1 }, minimumWidth: 40 },
      });

      const rsiLine = rsiChart.addSeries(LineSeries, {
        color: "#a855f7", lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
      });
      rsiLineSeries.current = rsiLine;

      const rsiOverbought = rsiChart.addSeries(LineSeries, {
        color: "#ef444480", lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
      });
      rsiOverboughtSeries.current = rsiOverbought;

      const rsiOversold = rsiChart.addSeries(LineSeries, {
        color: "#22c55e80", lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
      });
      rsiOversoldSeries.current = rsiOversold;

      rsiChartApi.current = rsiChart;
    }

    const handleResize = () => {
      const w = mainChartRef.current?.clientWidth || 800;
      mainChart.applyOptions({ width: w });
      if (rsiChartApi.current && rsiChartRef.current) rsiChartApi.current.applyOptions({ width: w });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [fullscreen, timeframe]);

  useEffect(() => {
    const cleanup = buildCharts();
    return () => {
      if (typeof cleanup === "function") cleanup();
      if (mainChartApi.current) { mainChartApi.current.remove(); mainChartApi.current = null; }
      if (rsiChartApi.current) { rsiChartApi.current.remove(); rsiChartApi.current = null; }
    };
  }, [buildCharts]);

  // Update data
  useEffect(() => {
    if (!candleSeries.current) return;
    const parts = selectedSymbol.split("_");
    const type = parts[0] as IndexType;
    const num = parseInt(parts[1]);
    const candles = getCandlesticksByTF(type, num, timeframe);

    if (candles.length === 0) return;

    candleSeries.current.setData(candles.map(c => ({
      time: c.time as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    })));

    // RSI
    const rsiData = computeRSIData(candles);
    if (rsiData.length > 0) {
      rsiLineSeries.current?.setData(rsiData);
      rsiOverboughtSeries.current?.setData(rsiData.map(d => ({ time: d.time, value: 70 })));
      rsiOversoldSeries.current?.setData(rsiData.map(d => ({ time: d.time, value: 30 })));
    }

    if (mainChartApi.current) {
      mainChartApi.current.timeScale().fitContent();
    }
  }, [selectedSymbol, timeframe, renderTick]);

  const derivState = getDerivState();
  const connected = derivState.source === "deriv-live";

  const getCurrentPrice = () => {
    const label = selectedSymbol.toLowerCase();
    return (derivState as any)[label]?.price ?? 0;
  };

  const getChange = () => {
    const label = selectedSymbol.toLowerCase();
    return (derivState as any)[label]?.change24h ?? 0;
  };

  const prediction = (() => {
    const parts = selectedSymbol.split("_");
    const result = predictSpike(parts[0] as IndexType, parseInt(parts[1]));
    if (!result || "error" in result) return null;
    return result as any;
  })();

  const price = getCurrentPrice();
  const change = getChange();
  const idx = INDICES.find(i => `${i.type}_${i.number}` === selectedSymbol);

  return (
    <section className={`py-6 px-4 ${fullscreen ? "fixed inset-0 z-50 bg-background overflow-y-auto" : ""}`}>
      <div className={fullscreen ? "" : "max-w-7xl mx-auto"}>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="text-primary" size={24} />
              Graphique {idx?.label}
            </h2>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${connected ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
              {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {connected ? "Live" : "Déconnecté"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setFullscreen(!fullscreen)} className="p-2 hover:bg-surface-light rounded-lg transition-colors">
              {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>

        {/* Symbol & Timeframe selector */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {INDICES.map(i => {
              const key = `${i.type}_${i.number}`;
              const isActive = selectedSymbol === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedSymbol(key)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${isActive ? "bg-primary text-white" : "bg-surface text-text-secondary hover:text-text"}`}
                >
                  {i.type === "BOOM" ? <Flame size={12} /> : <Droplet size={12} />}
                  {i.label}
                </button>
              );
            })}
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["1m", "5m", "15m"] as TimeFrame[]).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${timeframe === tf ? "bg-primary text-white" : "bg-surface text-text-secondary hover:text-text"}`}
              >{TF_LABELS[tf]}</button>
            ))}
          </div>

        </div>

        {/* Price bar */}
        <div className="flex items-center gap-4 mb-3 px-1">
          <span className="text-3xl font-bold font-mono">
            {price > 0 ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : "—"}
          </span>
          <span className={`text-lg font-mono ${change >= 0 ? "text-success" : "text-danger"}`}>
            {change >= 0 ? "+" : ""}{change.toFixed(2)}%
          </span>
          {prediction?.regime && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              prediction.regime.market === "trending_bull" ? "bg-success/15 text-success" :
              prediction.regime.market === "trending_bear" ? "bg-danger/15 text-danger" :
              prediction.regime.market === "volatile" ? "bg-warning/15 text-warning" :
              "bg-surface-light text-text-muted"
            }`}>
              {prediction.regime.market === "trending_bull" ? "Tendance haussière" :
               prediction.regime.market === "trending_bear" ? "Tendance baissière" :
               prediction.regime.market === "volatile" ? "Volatile" :
               prediction.regime.market === "calm" ? "Calme" : "Range"}
            </span>
          )}
          {prediction && (
            <span className="text-xs text-text-muted font-mono">
              v{typeof prediction.volScale === 'number' ? prediction.volScale.toFixed(1) : '-'}
              {typeof prediction.approachVelocity === 'number' && prediction.approachVelocity > 0
                ? ` · ${prediction.approachVelocity.toFixed(2)}`
                : ''}
            </span>
          )}
        </div>

        {/* Main chart area */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div ref={mainChartRef} />
          {/* RSI pane */}
          <div className="border-t border-border">
            <div className="flex items-center justify-between px-4 py-1.5 bg-surface/30">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">RSI (14)</span>
            </div>
            <div ref={rsiChartRef} />
          </div>
        </div>

        <p className="text-xs text-text-muted mt-3 text-center">
          {TF_LABELS[timeframe]} • {idx?.label} • Données live Deriv WebSocket
        </p>
      </div>
    </section>
  );
}
