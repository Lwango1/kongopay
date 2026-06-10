"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart, IChartApi, CandlestickSeries, LineSeries, HistogramSeries,
  ISeriesApi, ColorType,
} from "lightweight-charts";
import {
  TrendingUp, AlertTriangle, Flame, Droplet,
  Maximize2, Minimize2, Wifi, WifiOff,
  BarChart3, Activity, GanttChartSquare,
} from "lucide-react";
import { initDerivClient, getDerivState, predictSpike, getCandlesticksByTF } from "@/lib/deriv";
import type { IndexType, Candlestick } from "@/lib/deriv";
import { calculateBollingerBands, calculateSMA, calculateRSI, calculateMACD } from "@/lib/indicators";
import type { MACDResult } from "@/lib/indicators";

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

function computeMACDData(candles: Candlestick[]): {
  macdLine: { time: number; value: number }[];
  signalLine: { time: number; value: number }[];
  histogram: { time: number; value: number; color: string }[];
} {
  const prices = candles.map(c => c.close);
  const macdLine: { time: number; value: number }[] = [];
  const signalLine: { time: number; value: number }[] = [];
  const histogram: { time: number; value: number; color: string }[] = [];

  for (let i = 35; i < prices.length; i++) {
    const slice = prices.slice(0, i + 1);
    const result = calculateMACD(slice);
    if (result) {
      macdLine.push({ time: candles[i].time, value: Math.round(result.macd * 10000) / 10000 });
      signalLine.push({ time: candles[i].time, value: Math.round(result.signal * 10000) / 10000 });
      histogram.push({
        time: candles[i].time,
        value: Math.round(result.histogram * 10000) / 10000,
        color: result.histogram >= 0 ? "#22c55e" : "#ef4444",
      });
    }
  }

  return { macdLine, signalLine, histogram };
}

function computeBollingerData(candles: Candlestick[], period = 20, multiplier = 2): {
  upper: { time: number; value: number }[];
  middle: { time: number; value: number }[];
  lower: { time: number; value: number }[];
} {
  const prices = candles.map(c => c.close);
  const upper: { time: number; value: number }[] = [];
  const middle: { time: number; value: number }[] = [];
  const lower: { time: number; value: number }[] = [];

  for (let i = period; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, p) => sum + (p - avg) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);
    upper.push({ time: candles[i].time, value: avg + stdDev * multiplier });
    middle.push({ time: candles[i].time, value: avg });
    lower.push({ time: candles[i].time, value: avg - stdDev * multiplier });
  }

  return { upper, middle, lower };
}

function computeSMAData(candles: Candlestick[], period: number): { time: number; value: number }[] {
  const prices = candles.map(c => c.close);
  const data: { time: number; value: number }[] = [];
  for (let i = period; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    data.push({ time: candles[i].time, value: Math.round(slice.reduce((a, b) => a + b, 0) / period * 100) / 100 });
  }
  return data;
}

export default function DerivChart() {
  const [selectedSymbol, setSelectedSymbol] = useState("BOOM_500");
  const [timeframe, setTimeframe] = useState<TimeFrame>("1m");
  const [fullscreen, setFullscreen] = useState(false);
  const [renderTick, setRenderTick] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const mainChartRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<HTMLDivElement>(null);
  const macdChartRef = useRef<HTMLDivElement>(null);

  const mainChartApi = useRef<IChartApi | null>(null);
  const rsiChartApi = useRef<IChartApi | null>(null);
  const macdChartApi = useRef<IChartApi | null>(null);

  const candleSeries = useRef<ISeriesApi<"Candlestick", any> | null>(null);
  const bbUpperSeries = useRef<ISeriesApi<"Line", any> | null>(null);
  const bbMiddleSeries = useRef<ISeriesApi<"Line", any> | null>(null);
  const bbLowerSeries = useRef<ISeriesApi<"Line", any> | null>(null);
  const sma20Series = useRef<ISeriesApi<"Line", any> | null>(null);
  const sma50Series = useRef<ISeriesApi<"Line", any> | null>(null);
  const rsiLineSeries = useRef<ISeriesApi<"Line", any> | null>(null);
  const rsiOverboughtSeries = useRef<ISeriesApi<"Line", any> | null>(null);
  const rsiOversoldSeries = useRef<ISeriesApi<"Line", any> | null>(null);
  const macdLineSeries = useRef<ISeriesApi<"Line", any> | null>(null);
  const macdSignalSeries = useRef<ISeriesApi<"Line", any> | null>(null);
  const macdHistogramSeries = useRef<ISeriesApi<"Histogram", any> | null>(null);

  const pausedRef = useRef(false);
  const prevCandleCount = useRef(0);

  useEffect(() => { initDerivClient(); }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!pausedRef.current) setRenderTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const buildCharts = useCallback(() => {
    if (!mainChartRef.current) return;

    const mainHeight = fullscreen ? 400 : 320;
    const indicatorHeight = fullscreen ? 180 : 120;

    if (mainChartApi.current) {
      mainChartApi.current.remove();
      mainChartApi.current = null;
    }
    if (rsiChartApi.current) {
      rsiChartApi.current.remove();
      rsiChartApi.current = null;
    }
    if (macdChartApi.current) {
      macdChartApi.current.remove();
      macdChartApi.current = null;
    }

    candleSeries.current = null;
    bbUpperSeries.current = null;
    bbMiddleSeries.current = null;
    bbLowerSeries.current = null;
    sma20Series.current = null;
    sma50Series.current = null;
    rsiLineSeries.current = null;
    rsiOverboughtSeries.current = null;
    rsiOversoldSeries.current = null;
    macdLineSeries.current = null;
    macdSignalSeries.current = null;
    macdHistogramSeries.current = null;

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

    const bbUpper = mainChart.addSeries(LineSeries, {
      color: "#818cf8", lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
    });
    bbUpperSeries.current = bbUpper;

    const bbMiddle = mainChart.addSeries(LineSeries, {
      color: "#818cf8", lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
    });
    bbMiddleSeries.current = bbMiddle;

    const bbLower = mainChart.addSeries(LineSeries, {
      color: "#818cf8", lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
    });
    bbLowerSeries.current = bbLower;

    const sma20 = mainChart.addSeries(LineSeries, {
      color: "#f59e0b", lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
    });
    sma20Series.current = sma20;

    const sma50 = mainChart.addSeries(LineSeries, {
      color: "#06b6d4", lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
    });
    sma50Series.current = sma50;

    mainChartApi.current = mainChart;

    // RSI pane
    if (rsiChartRef.current) {
      const rsiChart = createChart(rsiChartRef.current, {
        layout: sharedLayout,
        grid: sharedGrid,
        width: mainChartRef.current.clientWidth,
        height: indicatorHeight,
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

    // MACD pane
    if (macdChartRef.current) {
      const macdChart = createChart(macdChartRef.current, {
        layout: sharedLayout,
        grid: sharedGrid,
        width: mainChartRef.current.clientWidth,
        height: indicatorHeight,
        crosshair: { mode: 0 },
        timeScale: { ...sharedTimeScale, visible: fullscreen },
        rightPriceScale: { borderColor: "#2d3748", scaleMargins: { top: 0.1, bottom: 0.1 }, minimumWidth: 40 },
      });

      const macdLine = macdChart.addSeries(LineSeries, {
        color: "#3b82f6", lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
      });
      macdLineSeries.current = macdLine;

      const macdSignal = macdChart.addSeries(LineSeries, {
        color: "#f97316", lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
      });
      macdSignalSeries.current = macdSignal;

      const macdHist = macdChart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceLineVisible: false, lastValueVisible: false,
      });
      macdHistogramSeries.current = macdHist;

      macdChartApi.current = macdChart;
    }

    const handleResize = () => {
      const w = mainChartRef.current?.clientWidth || 800;
      mainChart.applyOptions({ width: w });
      if (rsiChartApi.current && rsiChartRef.current) rsiChartApi.current.applyOptions({ width: w });
      if (macdChartApi.current && macdChartRef.current) macdChartApi.current.applyOptions({ width: w });
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
      if (macdChartApi.current) { macdChartApi.current.remove(); macdChartApi.current = null; }
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
    if (candles.length === prevCandleCount.current) return;
    prevCandleCount.current = candles.length;

    const candleData = candles.map(c => ({
      time: c.time as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.current.setData(candleData);

    // Bollinger Bands
    const bb = computeBollingerData(candles);
    if (bbUpperSeries.current && bb.upper.length > 0) {
      bbUpperSeries.current.setData(bb.upper);
      bbMiddleSeries.current?.setData(bb.middle);
      bbLowerSeries.current?.setData(bb.lower);
    }

    // SMA
    const sma20 = computeSMAData(candles, 20);
    const sma50 = computeSMAData(candles, 50);
    if (sma20.length > 0) sma20Series.current?.setData(sma20);
    if (sma50.length > 0) sma50Series.current?.setData(sma50);

    // RSI
    const rsiData = computeRSIData(candles);
    if (rsiData.length > 0) {
      rsiLineSeries.current?.setData(rsiData);
      rsiOverboughtSeries.current?.setData(rsiData.map(d => ({ time: d.time, value: 70 })));
      rsiOversoldSeries.current?.setData(rsiData.map(d => ({ time: d.time, value: 30 })));
    }

    // MACD
    const macdData = computeMACDData(candles);
    if (macdData.macdLine.length > 0) {
      macdLineSeries.current?.setData(macdData.macdLine);
      macdSignalSeries.current?.setData(macdData.signalLine);
      macdHistogramSeries.current?.setData(macdData.histogram);
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
          <button
            onClick={() => setExpanded(!expanded)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1 ${expanded ? "bg-primary/10 border-primary/30 text-primary" : "bg-surface border-border text-text-secondary hover:text-text"}`}
          >
            <Activity size={14} />
            Détails
          </button>
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
        </div>

        {/* Main chart area */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div ref={mainChartRef} />
          {prediction?.indicators && (
            <div className="flex gap-4 px-4 py-2 border-t border-border text-[10px] text-text-muted bg-surface/50">
              {prediction.indicators.macd && (
                <span>MACD: <span className={prediction.indicators.macd.histogram >= 0 ? "text-success" : "text-danger"}>{prediction.indicators.macd.histogram > 0 ? "+" : ""}{prediction.indicators.macd.histogram.toFixed(4)}</span></span>
              )}
              {prediction.indicators.bollinger && (
                <span>BB: <span className="text-indigo-400">{prediction.indicators.bollinger.bandwidth.toFixed(4)}</span></span>
              )}
              {prediction.indicators.adx && (
                <span>ADX: <span className={prediction.indicators.adx > 25 ? "text-success" : "text-text-muted"}>{prediction.indicators.adx}</span></span>
              )}
              {prediction.indicators.stochRsi && (
                <span>StochRSI: <span className={prediction.indicators.stochRsi > 80 ? "text-danger" : prediction.indicators.stochRsi < 20 ? "text-success" : "text-text-muted"}>{prediction.indicators.stochRsi}</span></span>
              )}
            </div>
          )}

          {/* RSI pane */}
          <div className="border-t border-border">
            <div className="flex items-center justify-between px-4 py-1.5 bg-surface/30">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">RSI (14)</span>
              {prediction?.indicators?.stochRsi && (
                <span className="text-[10px] text-text-muted">StochRSI: {prediction.indicators.stochRsi}</span>
              )}
            </div>
            <div ref={rsiChartRef} />
          </div>

          {/* MACD pane */}
          <div className="border-t border-border">
            <div className="flex items-center justify-between px-4 py-1.5 bg-surface/30">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">MACD (12, 26, 9)</span>
            </div>
            <div ref={macdChartRef} />
          </div>

          {/* Prediction details */}
          {expanded && prediction && (
            <div className="border-t border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`font-bold font-mono text-lg ${prediction.isSpikeImminent ? "text-danger" : prediction.spikeProbability > 50 ? "text-warning" : "text-success"}`}>
                    {prediction.spikeProbability}%
                  </span>
                  <span className="text-xs text-text-muted">probabilité de spike</span>
                  {prediction.isSpikeImminent && <AlertTriangle size={16} className="text-danger animate-pulse" />}
                </div>
                <span className="text-xs font-medium text-text-muted">
                  Direction: <span className={prediction.expectedDirection === "up" ? "text-success" : "text-danger"}>{prediction.expectedDirection === "up" ? "HAUSSE" : "BAISSE"}</span>
                </span>
              </div>

              <div className="w-full h-1.5 bg-surface-light rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${prediction.spikeProbability}%`,
                    background: prediction.isSpikeImminent ? "#ef4444" : prediction.spikeProbability > 50 ? "#f59e0b" : "#22c55e",
                  }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-success/5 border border-success/20 p-2.5 text-center">
                  <p className="text-[9px] text-text-muted uppercase font-semibold">Entrée</p>
                  <p className="font-bold font-mono text-sm text-text mt-0.5">
                    ${prediction.entryPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-danger/5 border border-danger/20 p-2.5 text-center">
                  <p className="text-[9px] text-text-muted uppercase font-semibold">Stop Loss</p>
                  <p className="font-bold font-mono text-sm text-danger mt-0.5">
                    ${prediction.stopLoss?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-success/5 border border-success/20 p-2.5 text-center">
                  <p className="text-[9px] text-text-muted uppercase font-semibold">Take Profit</p>
                  <p className="font-bold font-mono text-sm text-success mt-0.5">
                    ${prediction.takeProfit?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "—"}
                  </p>
                </div>
              </div>

              {prediction.candlePatterns && prediction.candlePatterns.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {prediction.candlePatterns.map((p: any, i: number) => (
                    <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                      p.signal === "bullish" ? "bg-success/10 text-success border border-success/20" :
                      p.signal === "bearish" ? "bg-danger/10 text-danger border border-danger/20" :
                      "bg-surface-light text-text-muted border border-border"
                    }`}>
                      {p.name}
                    </span>
                  ))}
                </div>
              )}

              {prediction.sRlevels && prediction.sRlevels.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-text-muted uppercase mb-1.5">Niveaux S/R</p>
                  <div className="flex flex-wrap gap-1.5">
                    {prediction.sRlevels.map((level: any, i: number) => (
                      <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                        level.type === "support"
                          ? "bg-success/10 text-success border border-success/20"
                          : "bg-danger/10 text-danger border border-danger/20"
                      }`}>
                        ${level.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                        <span className="opacity-60">x{level.strength}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[10px] text-text-secondary leading-relaxed p-2.5 rounded-lg bg-surface-light/50 border border-border">
                <span className="font-semibold text-text-muted">Analyse : </span>
                {prediction.consecutiveMoves !== undefined && `${prediction.consecutiveMoves} mouvements consécutifs • `}
                Distance S/R: {prediction.distancePercent ?? 0}% • 
                Force S/R: {prediction.referenceStrength ?? 0} touches • 
                Dernier spike: {prediction.timeSinceLastSpike ?? 0}s
                {prediction.regime?.recommendation && ` • ${prediction.regime.recommendation}`}
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-text-muted mt-3 text-center">
          {TF_LABELS[timeframe]} • {idx?.label} • Données live Deriv WebSocket
        </p>
      </div>
    </section>
  );
}
