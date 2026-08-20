// Real Deriv WebSocket API — Live synthetic indices (Boom & Crash)
// Requires DERIV_APP_ID env variable (get one free at https://app.deriv.com/account/api-token)

import { fitSpikeIntervals, spikeProbability } from "./spikeIntervalModel";
import { computeAdvancedFeatures } from "./advancedFeatures";
import { calculateATR, calculateRSI } from "./indicators";

export type IndexType = "BOOM" | "CRASH";

let touchModeEnabled = true;

export function setTouchMode(v: boolean) { touchModeEnabled = v; }
export function getTouchMode() { return touchModeEnabled; }

export interface IndexState {
  price: number;
  change24h: number;
  history: number[];
  timestamps: number[];
  lastSpikeTime: number;
  lastSpikeDirection: "up" | "down" | null;
  spikeIntervals: number[];
  spikeIntervalModel: import("./spikeIntervalModel").SpikeIntervalModel;
  connected: boolean;
  prevSignal: Signal | null;
  prevSignalPrice: number;
  prevSignalTime: number;
  confirmationTriggered: boolean;
}

export type Signal = "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";

export interface TradeSignal {
  signal: Signal;
  direction: "up" | "down";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  reason: string;
  isConfirmed: boolean;
  confirmationPrice: number | null;
  indicators?: any;
}

export interface Candlestick {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface DerivSnapshot {
  timestamp: number;
  source: "deriv-live" | "disconnected";
  [key: string]: any;
}

const INDICES: { type: IndexType; number: number; symbol: string }[] = [
  { type: "CRASH", number: 900, symbol: "CRASH900" },
];

function getKey(type: IndexType, num: number) { return `${type}_${num}`; }
function keyFromSymbol(symbol: string): string | null {
  const idx = INDICES.find(i => i.symbol === symbol);
  return idx ? getKey(idx.type, idx.number) : null;
}

const stateMap = new Map<string, IndexState>();
const candleMap15m = new Map<string, Candlestick[]>();
const candleMap30m = new Map<string, Candlestick[]>();
const candleMap60m = new Map<string, Candlestick[]>();
const candleMap120m = new Map<string, Candlestick[]>();
const priceAt24hAgo = new Map<string, number>();

// Suivi de performance des signaux pour seuils adaptatifs
const signalPerformance = new Map<string, { total: number; wins: number; recentAccuracy: number; history: { win: boolean; timestamp: number }[] }>();

export function recordSignalOutcome(indexKey: string, wasWin: boolean) {
  const stats = signalPerformance.get(indexKey) || { total: 0, wins: 0, recentAccuracy: 0.55, history: [] };
  stats.total++;
  if (wasWin) stats.wins++;
  stats.history.push({ win: wasWin, timestamp: Date.now() });
  // Keep last 50 outcomes
  if (stats.history.length > 50) stats.history.shift();
  // Recent accuracy over last 20 signals
  const recent = stats.history.slice(-20);
  stats.recentAccuracy = recent.length > 0 ? recent.filter(h => h.win).length / recent.length : 0.55;
  signalPerformance.set(indexKey, stats);
}

function initCandleMap(map: Map<string, Candlestick[]>) {
  for (const idx of INDICES) map.set(getKey(idx.type, idx.number), []);
}

for (const idx of INDICES) {
  stateMap.set(getKey(idx.type, idx.number), {
    price: 0,
    change24h: 0,
    history: [],
    timestamps: [],
    lastSpikeTime: Date.now(),
    lastSpikeDirection: null,
    spikeIntervals: [],
    spikeIntervalModel: { shape: 1, scale: 1, mean: 0, stdDev: 0, sampleSize: 0, ready: false },
    connected: false,
    prevSignal: null,
    prevSignalPrice: 0,
    prevSignalTime: 0,
    confirmationTriggered: false,
  });
}
initCandleMap(candleMap15m);
initCandleMap(candleMap30m);
initCandleMap(candleMap60m);
initCandleMap(candleMap120m);

let ws: any = null;
let wsConnected = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let historyLoaded = false;
let reconnectDelay = 1000;
const maxReconnectDelay = 30000;
const DERIV_TOKEN = process.env.NEXT_PUBLIC_DERIV_TOKEN || "";
const DERIV_WS_URL = DERIV_TOKEN
  ? `wss://api.derivws.com/trading/v1/options/ws/real?otp=${DERIV_TOKEN}`
  : "wss://ws.derivws.com/websockets/v3?app_id=1089";

const isServer = typeof window === "undefined";

function createWebSocket(url: string): any {
  if (isServer) {
    try {
      const { WebSocket: WsWebSocket } = require("ws");
      return new WsWebSocket(url);
    } catch {
      return new (require("ws"))(url);
    }
  }
  return new WebSocket(url);
}

const CANDLE_INTERVALS = [
  { seconds: 900, map: candleMap15m, label: "15m" },
  { seconds: 1800, map: candleMap30m, label: "30m" },
  { seconds: 3600, map: candleMap60m, label: "1h" },
  { seconds: 7200, map: candleMap120m, label: "2h" },
];

function updateCandleMulti(key: string, price: number, timeMs: number) {
  for (const { seconds, map } of CANDLE_INTERVALS) {
    const candles = map.get(key);
    if (!candles) continue;
    const candleTime = Math.floor(timeMs / 1000 / seconds) * seconds;
    if (candles.length === 0 || candles[candles.length - 1].time !== candleTime) {
      candles.push({ time: candleTime, open: price, high: price, low: price, close: price });
      if (candles.length > 200) candles.shift();
    } else {
      const last = candles[candles.length - 1];
      last.high = Math.max(last.high, price);
      last.low = Math.min(last.low, price);
      last.close = price;
    }
  }
}

function candlePrices(map: Map<string, Candlestick[]>, key: string): number[] {
  return (map.get(key) || []).map(c => c.close);
}

function onTick(symbol: string, quote: number, epoch: number) {
  const key = keyFromSymbol(symbol);
  if (!key) return;
  const st = stateMap.get(key);
  if (!st) return;

  const ts = epoch * 1000;

  if (st.price > 0) {
    const spikeSize = Math.abs(quote - st.price) / st.price;
    if (spikeSize > 0.015) {
      if (st.lastSpikeTime > 0) {
        const interval = ts - st.lastSpikeTime;
        if (interval > 1000) {
          st.spikeIntervals.push(interval);
          if (st.spikeIntervals.length > 50) st.spikeIntervals.shift();
          if (st.spikeIntervals.length >= 3) {
            st.spikeIntervalModel = fitSpikeIntervals(st.spikeIntervals);
          }
        }
      }
      st.lastSpikeTime = ts;
      st.lastSpikeDirection = quote > st.price ? "up" : "down";
    }
  }

  st.price = quote;
  st.history.push(quote);
  st.timestamps.push(ts);
  st.connected = true;

  updateCandleMulti(key, quote, ts);

  if (st.history.length > 500) {
    st.history.shift();
    st.timestamps.shift();
  }

  if (priceAt24hAgo.has(key) && st.history.length > 0) {
    const oldPrice = priceAt24hAgo.get(key)!;
    if (oldPrice > 0) {
      st.change24h = ((quote - oldPrice) / oldPrice) * 100;
    }
  }
}

function processMessage(data: any) {
  if (data.msg_type === "tick" && data.tick) {
    onTick(data.tick.symbol, data.tick.quote, data.tick.epoch);
  }

  if (data.msg_type === "history" && data.history) {
    const prices: number[] = data.history.prices;
    const times: number[] = data.history.times;

    const symbol = data.echo_req?.ticks_history;
    const key = keyFromSymbol(symbol);
    if (!key || !prices) return;

    const st = stateMap.get(key)!;
    st.history = prices;
    st.timestamps = times.map((t: number) => t * 1000);
    st.price = prices[prices.length - 1];
    st.connected = true;

    // Build candles from history so multi-TF analysis works immediately
    candleMap15m.set(key, []);
    candleMap30m.set(key, []);
    candleMap60m.set(key, []);
    candleMap120m.set(key, []);
    if (times.length === prices.length) {
      for (let i = 0; i < prices.length; i++) {
        updateCandleMulti(key, prices[i], times[i] * 1000);
      }
    }

    // Detect spikes in historical data for real lastSpikeTime and spikeIntervals
    let lastKnownSpikeTime = st.lastSpikeTime;
    let lastKnownPrice = prices[0];
    for (let i = 1; i < prices.length; i++) {
      const change = Math.abs(prices[i] - lastKnownPrice) / lastKnownPrice;
      if (change > 0.015) {
        const spikeTs = (times[i] || 0) * 1000;
        if (lastKnownSpikeTime > 0 && spikeTs > lastKnownSpikeTime) {
          const interval = spikeTs - lastKnownSpikeTime;
          if (interval > 1000) {
            st.spikeIntervals.push(interval);
            if (st.spikeIntervals.length > 50) st.spikeIntervals.shift();
          }
        }
        lastKnownSpikeTime = spikeTs;
        st.lastSpikeDirection = prices[i] > lastKnownPrice ? "up" : "down";
        lastKnownPrice = prices[i];
      }
    }
    if (lastKnownSpikeTime > 0) {
      st.lastSpikeTime = lastKnownSpikeTime;
    }
    // Fit Weibull model from historical spike intervals
    if (st.spikeIntervals.length >= 3) {
      st.spikeIntervalModel = fitSpikeIntervals(st.spikeIntervals);
    }

    if (prices.length > 1440) {
      priceAt24hAgo.set(key, prices[prices.length - 1440]);
    } else if (prices.length > 0) {
      priceAt24hAgo.set(key, prices[0]);
    }
  }
}

const INDICES_FOR_HISTORY = [
  "CRASH900",
];

function subscribeAll() {
  if (!ws || ws.readyState !== 1) return;

  for (const symbol of INDICES_FOR_HISTORY) {
    ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    ws.send(JSON.stringify({
      ticks_history: symbol,
      adjust_start_time: 1,
      end: "latest",
      start: 1,
      style: "ticks",
    }));
  }
  historyLoaded = true;
}

function wsOn(ws: any, event: string, handler: (...args: any[]) => void) {
  if (isServer) {
    ws.on(event, handler);
  } else {
    const prop = `on${event}` as keyof WebSocket;
    (ws as any)[prop] = handler;
  }
}

function startKeepAlive() {
  stopKeepAlive();
  if (isServer) {
    keepAliveTimer = setInterval(() => {
      if (ws && ws.readyState === 1) { ws.ping(); }
    }, 25000);
  } else {
    keepAliveTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify({ ping: 1 })); }
    }, 25000);
  }
}

function stopKeepAlive() {
  if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const delay = reconnectDelay + Math.random() * 1000;
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
    connectDerivWebSocket();
  }, delay);
}

export function connectDerivWebSocket(): boolean {
  if (ws && ws.readyState === (isServer ? 1 : WebSocket.OPEN)) return true;
  if (!DERIV_WS_URL) return false;

  try {
    ws = createWebSocket(DERIV_WS_URL);

    const onOpen = () => {
      wsConnected = true;
      reconnectDelay = 1000;
      historyLoaded = false;
      subscribeAll();
      startKeepAlive();
      if (!isServer) {
        console.log(`[Deriv] Connected to ${DERIV_WS_URL.split("?")[0]}${DERIV_TOKEN ? " (authentifié)" : ""}`);
      }
    };

    const onMessage = (data: any) => {
      try {
        const payload = typeof data === "string" ? data : isServer ? data.toString() : data.data;
        processMessage(JSON.parse(payload));
      } catch { /* ignore parse errors */ }
    };

    const onClose = () => {
      wsConnected = false;
      ws = null;
      stopKeepAlive();
      for (const st of stateMap.values()) {
        st.connected = false;
      }
      if (!isServer) console.log("[Deriv] Disconnected, reconnexion dans " + Math.round(reconnectDelay / 1000) + "s");
      scheduleReconnect();
    };

    const onError = (err: any) => {
      if (!isServer) console.error("[Deriv] WebSocket error:", err?.message || err);
      wsConnected = false;
      stopKeepAlive();
      scheduleReconnect();
    };

    wsOn(ws, "open", onOpen);
    wsOn(ws, "message", onMessage);
    wsOn(ws, "close", onClose);
    wsOn(ws, "error", onError);

    return true;
  } catch (err) {
    console.error("[Deriv] Failed to create WebSocket:", err);
    wsConnected = false;
    scheduleReconnect();
    return false;
  }
}

export function disconnectDerivWebSocket() {
  stopKeepAlive();
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (ws) {
    ws.close();
    ws = null;
  }
  wsConnected = false;
  for (const st of stateMap.values()) {
    st.connected = false;
  }
}

export function isDerivWebSocketConnected(): boolean {
  return wsConnected;
}

export function getDerivState(): DerivSnapshot {
  const result: DerivSnapshot = {
    timestamp: Date.now(),
    source: wsConnected ? "deriv-live" : "disconnected",
  };

  for (const idx of INDICES) {
    const key = getKey(idx.type, idx.number);
    const st = stateMap.get(key)!;

    if (st.history.length > 0) {
      const minIdx = Math.max(0, st.history.length - 100);
      const recentPrices = st.history.slice(minIdx);
      const recentTimes = st.timestamps.slice(minIdx);

      if (recentPrices.length > 1) {
        const first = recentPrices[0];
        const last = recentPrices[recentPrices.length - 1];
        let change = 0;
        if (first > 0) {
          change = ((last - first) / first) * 100;
        }
        st.change24h = change;
      }
    }

    const label = `${idx.type.toLowerCase()}_${idx.number}`;
    result[label] = {
      price: st.price,
      change24h: st.change24h,
      history: st.history.slice(-100),
      timestamps: st.timestamps.slice(-100),
      type: idx.type,
      number: idx.number,
      lastSpikeTime: st.lastSpikeTime,
      lastSpikeDirection: st.lastSpikeDirection,
      connected: st.connected,
    };
  }

  return result;
}

const CLUSTER_TOLERANCE = 0.002;

interface SRLevel {
  price: number;
  strength: number;
  type: "support" | "resistance";
}

interface OrderBlock {
  price: number;
  type: "bullish" | "bearish";
  strength: number;
  rangeLow: number;
  rangeHigh: number;
}

interface MarketStructure {
  trend: "uptrend" | "downtrend" | "ranging";
  lastBreakout: "bullish" | "bearish" | null;
  liquiditySwept: boolean;
  imbalance: number;
}

function findPivots(prices: number[], lookback: number = 3, minMovePct: number = 0): { price: number; isHigh: boolean; strength: number }[] {
  const pivots: { price: number; isHigh: boolean; strength: number }[] = [];
  for (let i = lookback; i < prices.length - lookback; i++) {
    const curr = prices[i];
    const left = prices.slice(i - lookback, i);
    const right = prices.slice(i + 1, i + lookback + 1);

    const highCheck = left.every(p => curr > p) && right.every(p => curr > p);
    const lowCheck = left.every(p => curr < p) && right.every(p => curr < p);

    if (highCheck || lowCheck) {
      const avgNeighbor = ([...left, ...right].reduce((a, b) => a + b, 0) / (lookback * 2));
      const movePct = Math.abs(curr - avgNeighbor) / (avgNeighbor || 1);
      if (movePct < minMovePct) continue;
    }

    if (highCheck) {
      const existing = pivots.find(p => p.isHigh && Math.abs(p.price - curr) / curr < CLUSTER_TOLERANCE);
      if (existing) { existing.strength++; existing.price = (existing.price + curr) / 2; }
      else pivots.push({ price: curr, isHigh: true, strength: 1 });
    }
    if (lowCheck) {
      const existing = pivots.find(p => !p.isHigh && Math.abs(p.price - curr) / curr < CLUSTER_TOLERANCE);
      if (existing) { existing.strength++; existing.price = (existing.price + curr) / 2; }
      else pivots.push({ price: curr, isHigh: false, strength: 1 });
    }
  }
  return pivots;
}

function analyzeMarketStructure(prices: number[]): MarketStructure {
  const recent = prices.slice(-120);
  if (recent.length < 20) return { trend: "ranging", lastBreakout: null, liquiditySwept: false, imbalance: 0 };

  const atrPct = calculateATR(recent) / (recent.reduce((a, b) => a + b, 0) / recent.length);
  const minMove = Math.max(atrPct * 1.5, 0.0005);
  const pivots = findPivots(recent, 5, minMove);
  const highs = pivots.filter(p => p.isHigh).sort((a, b) => b.price - a.price);
  const lows = pivots.filter(p => !p.isHigh).sort((a, b) => a.price - b.price);

  const higherHigh = highs.length >= 2 && highs[0].price > highs[1].price;
  const lowerLow = lows.length >= 2 && lows[0].price < lows[1].price;
  const lowerHigh = highs.length >= 2 && highs[0].price < highs[1].price;
  const higherLow = lows.length >= 2 && lows[0].price > lows[1].price;

  let trend: "uptrend" | "downtrend" | "ranging" = "ranging";
  if (higherHigh && higherLow) trend = "uptrend";
  else if (lowerHigh && lowerLow) trend = "downtrend";

  const currentPrice = recent[recent.length - 1];
  const lastHigh = highs[0]?.price ?? currentPrice;
  const lastLow = lows[0]?.price ?? currentPrice;

  const liquiditySwept = currentPrice > lastHigh * 1.001 || currentPrice < lastLow * 0.999;

  const shortAvg = prices.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const longAvg = prices.slice(-40).reduce((a, b) => a + b, 0) / 40;
  const imbalance = (shortAvg - longAvg) / longAvg;

  return { trend, lastBreakout: liquiditySwept ? (currentPrice > lastHigh ? "bullish" : "bearish") : null, liquiditySwept, imbalance };
}

function findOrderBlocks(prices: number[]): OrderBlock[] {
  const blocks: OrderBlock[] = [];
  const recent = prices.slice(-200);
  if (recent.length < 30) return blocks;

  const avgMove = calculateATR(recent) / (recent.reduce((a, b) => a + b, 0) / recent.length);
  const bodyThreshold = Math.max(avgMove * 1.5, 0.0008);

  for (let i = 5; i < recent.length - 5; i++) {
    const candle = recent[i];
    const prev = recent[i - 1];
    const next1 = recent[i + 1], next2 = recent[i + 2], next3 = recent[i + 3];

    const change = candle - prev;
    const bodySize = Math.abs(change) / candle;
    if (bodySize < bodyThreshold) continue;

    const low = Math.min(candle, prev);
    const high = Math.max(candle, prev);

    if (change < 0 && next1 > candle && next2 > candle && next3 > candle) {
      const existing = blocks.find(b => b.type === "bullish" && Math.abs(b.price - low) / (low || 1) < CLUSTER_TOLERANCE);
      if (existing) { existing.strength++; existing.price = (existing.price * (existing.strength - 1) + low) / existing.strength; }
      else blocks.push({ price: low, type: "bullish", strength: 1, rangeLow: low, rangeHigh: high });
    }

    if (change > 0 && next1 < candle && next2 < candle && next3 < candle) {
      const existing = blocks.find(b => b.type === "bearish" && Math.abs(b.price - high) / (high || 1) < CLUSTER_TOLERANCE);
      if (existing) { existing.strength++; existing.price = (existing.price * (existing.strength - 1) + high) / existing.strength; }
      else blocks.push({ price: high, type: "bearish", strength: 1, rangeLow: low, rangeHigh: high });
    }
  }

  return blocks.sort((a, b) => b.strength - a.strength).slice(0, 6);
}

/** Niveaux S/R basés sur les vrais pivots du marché (utilisés pour l'affichage) */
function findRealSR(prices: number[], currentPrice: number): {
  nearestSupport: SRLevel | null;
  nearestResistance: SRLevel | null;
  allLevels: SRLevel[];
} {
  const avgPrice = prices.slice(-20).reduce((a, b) => a + b, 0) / 20 || 1;
  const atrPct = calculateATR(prices.slice(-100)) / avgPrice;
  const minMove3 = Math.max(atrPct * 1.2, 0.0003);
  const minMove5 = Math.max(atrPct * 1.5, 0.0005);
  const minMove8 = Math.max(atrPct * 2.0, 0.0008);
  const pivots3 = findPivots(prices.slice(-80), 3, minMove3);
  const pivots5 = findPivots(prices.slice(-120), 5, minMove5);
  const pivots8 = findPivots(prices.slice(-200), 8, minMove8);

  const allPivots = [...pivots3, ...pivots5, ...pivots8];
  const clusters: { price: number; strength: number; isHigh: boolean }[] = [];

  for (const p of allPivots) {
    const existing = clusters.find(c => Math.abs(c.price - p.price) / p.price < CLUSTER_TOLERANCE * 1.5 && c.isHigh === p.isHigh);
    if (existing) {
      existing.price = (existing.price * existing.strength + p.price * p.strength) / (existing.strength + p.strength);
      existing.strength += p.strength;
    } else {
      clusters.push({ price: p.price, strength: p.strength, isHigh: p.isHigh });
    }
  }

  // Filtrer : strength minimum 3 (détecté par au moins 2 fonctions de lookback)
  const minClusterStrength = 3;

  const supports: SRLevel[] = clusters
    .filter(c => c.strength >= minClusterStrength && c.price < currentPrice)
    .map(c => ({ price: c.price, strength: c.strength, type: "support" as const }))
    .sort((a, b) => b.price - a.price);

  const resistances: SRLevel[] = clusters
    .filter(c => c.strength >= minClusterStrength && c.price > currentPrice)
    .map(c => ({ price: c.price, strength: c.strength, type: "resistance" as const }))
    .sort((a, b) => a.price - b.price);

  const scoreLevel = (level: SRLevel): number => {
    const distPct = Math.abs(level.price - currentPrice) / currentPrice;
    const distScore = Math.max(0, 1 - distPct / 0.03);
    return distScore * 0.3 + Math.min(level.strength / 8, 1) * 0.7;
  };

  const getStrongest = (levels: SRLevel[]): SRLevel | null => {
    if (levels.length === 0) return null;
    return levels.reduce((best, l) => scoreLevel(l) > scoreLevel(best) ? l : best);
  };

  const allLevels = [...supports, ...resistances].sort((a, b) => b.strength - a.strength);

  return {
    nearestSupport: getStrongest(supports),
    nearestResistance: getStrongest(resistances),
    allLevels,
  };
}

/** Niveaux de référence pour le scoring (utilise les percentiles en fallback) */
function getReferenceLevel(type: IndexType, history: number[], currentPrice: number): {
  refLevel: number; refStrength: number;
  refType: "support" | "resistance";
  fallbackLevels: SRLevel[];
} {
  const isBoom = type === "BOOM";
  const pivotSR = findRealSR(history, currentPrice);
  const nearest = isBoom ? pivotSR.nearestSupport : pivotSR.nearestResistance;
  if (nearest) {
    return {
      refLevel: nearest.price, refStrength: nearest.strength,
      refType: nearest.type,
      fallbackLevels: pivotSR.allLevels,
    };
  }
  // Fallback percentiles pour le scoring uniquement
  const sorted = [...history].sort((a, b) => a - b);
  const len = sorted.length;
  if (len < 5) {
    const fallback = isBoom ? Math.min(...history.slice(-20)) : Math.max(...history.slice(-20));
    const defType = isBoom ? "support" as const : "resistance" as const;
    return { refLevel: fallback, refStrength: 1, refType: defType, fallbackLevels: [] };
  }
  const percentileIdx = isBoom ? Math.floor(len * 0.15) : Math.floor(len * 0.85);
  const level = sorted[Math.max(0, Math.min(percentileIdx, len - 1))];
  const defType = isBoom ? "support" as const : "resistance" as const;
  return { refLevel: level, refStrength: 1, refType: defType, fallbackLevels: [] };
}

function scoreSignal(
  currentPrice: number, level: number | null, strength: number,
  history: number[], isUp: boolean, rsiVal: number, market: MarketStructure
): { score: number; referenceLevel: number; referenceStrength: number; distancePct: number; consecutive: number } {
  const refLevel = level ?? (isUp ? Math.min(...history.slice(-20)) : Math.max(...history.slice(-20)));
  const refStrength = level ? strength : 1;

  const distance = Math.abs(currentPrice - refLevel);
  const avgPrice = (currentPrice + refLevel) / 2;
  const maxDist = avgPrice * (isUp ? 0.02 : 0.02);
  const proximity = Math.max(0, 1 - distance / maxDist);
  const nearLevel = proximity > 0.3 ? 1 : 0;

  const recentMoves = history.slice(-15).map((p, i, arr) => i > 0 ? p - arr[i - 1] : 0).slice(1);
  const consecFiltered = recentMoves.slice(-5).filter(m => isUp ? m < 0 : m > 0);
  const consecutive = consecFiltered.length;
  const momentumScore = Math.min(consecutive / 5, 1);

  const exhaustionScore = consecutive >= 4 ? 0.3 : 0;

  let rsiScore = 0;
  if (isUp && rsiVal < 15) rsiScore = 0.2;
  else if (!isUp && rsiVal > 85) rsiScore = 0.2;
  else if (isUp && rsiVal < 25) rsiScore = 0.1;
  else if (!isUp && rsiVal > 75) rsiScore = 0.1;

  let marketScore = 0;
  if (isUp && market.trend === "uptrend") marketScore = 0.1;
  else if (!isUp && market.trend === "downtrend") marketScore = 0.1;
  else if (market.trend === "ranging") marketScore = 0.05;

  if (isUp && market.liquiditySwept && market.lastBreakout === "bullish") marketScore += 0.08;
  else if (!isUp && market.liquiditySwept && market.lastBreakout === "bearish") marketScore += 0.08;

  const strengthBonus = Math.min(refStrength / 5, 1) * 0.08;

  const score = nearLevel * 0.12 + momentumScore * 0.15 + rsiScore + marketScore + strengthBonus + exhaustionScore;
  return { score: Math.min(score, 1), referenceLevel: refLevel, referenceStrength: refStrength, distancePct: distance / (refLevel || currentPrice) * 100, consecutive };
}

export interface SRAlert {
  hasSRLevel: boolean;
  levelPrice: number;
  levelStrength: number;
  levelType: "support" | "resistance";
  distancePercent: number;
  isApproaching: boolean;
  approachVelocity: number;
  approachAcceleration: number;
  levelTouched: boolean;
  touchTimestamp: number | null;
  srAlertType: "none" | "approaching" | "touched" | "breaking";
  srConfidence: number;
  tfConfluence: number;
}

export function predictSpike(type: IndexType, num: number) {
  const key = getKey(type, num);
  const st = stateMap.get(key);
  if (!st || st.history.length < 30) {
    return { error: "Pas assez de données historiques" };
  }

  const history = st.history;
  const currentPrice = st.price;
  const vol = calculateATR(history);
  const rsiVal = calculateRSI(history);
  const market = analyzeMarketStructure(history);
  // S/R réels pour l'affichage (uniquement pivots)
  const { nearestSupport, nearestResistance, allLevels } = findRealSR(history, currentPrice);
  // Niveau de référence pour le scoring (percentile en fallback si pas de pivot)
  const ref = getReferenceLevel(type, history, currentPrice);
  const refLevel = ref.refLevel;
  const refStrength = ref.refStrength;
  const refType = ref.refType;
  const orderBlocks = findOrderBlocks(history);

  const isBoom = type === "BOOM";
  const isUp = isBoom;

  const bestOB = orderBlocks.length > 0 && Math.abs(orderBlocks[0].price - currentPrice) / currentPrice < 0.01
    ? orderBlocks[0]
    : null;

  // === S/R ALERT SYSTEM ===
  const distanceToRef = Math.abs(currentPrice - refLevel) / (refLevel || currentPrice);
  const proximity = Math.max(0, 1 - distanceToRef / 0.02);

  // Approach detection
  const approachLevel = isBoom ? nearestSupport?.price : nearestResistance?.price;
  let isApproaching = false;
  let approachVelocity = 0;
  let approachAcceleration = 0;
  if (approachLevel) {
    const recent = history.slice(-15);
    let towardCount = 0;
    for (let i = 1; i < recent.length; i++) {
      const priceRise = recent[i] > recent[i - 1];
      const levelAbove = approachLevel > currentPrice;
      if (levelAbove ? priceRise : !priceRise) towardCount++;
    }
    const slice = history.slice(-8);
    const slope = (slice[slice.length - 1] - slice[0]) / slice.length;
    const avgPrice2 = (currentPrice + approachLevel) / 2 || 1;
    const volScale2 = vol > 0 ? Math.max((vol / avgPrice2) / 0.0005, 0.5) : 1;
    approachVelocity = Math.abs(slope) / avgPrice2 / volScale2;

    const slice2 = history.slice(-15);
    const slope2 = (slice2[slice2.length - 1] - slice2[0]) / slice2.length;
    approachAcceleration = Math.abs(slope - slope2) / avgPrice2 / volScale2;

    isApproaching = towardCount >= 4 || (towardCount >= 2 && approachVelocity > 0.2);
  }

  // Level touched detection
  const touchThreshold = 0.0008;
  const touchWindow = Math.min(history.length, 40);
  let levelTouched = false;
  let touchTimestamp: number | null = null;
  if (isBoom && nearestSupport) {
    for (let i = history.length - touchWindow; i < history.length; i++) {
      if (Math.abs(history[i] - nearestSupport.price) / nearestSupport.price < touchThreshold) {
        levelTouched = true;
        touchTimestamp = st.timestamps[i] ?? Date.now();
        break;
      }
    }
  } else if (!isBoom && nearestResistance) {
    for (let i = history.length - touchWindow; i < history.length; i++) {
      if (Math.abs(history[i] - nearestResistance.price) / nearestResistance.price < touchThreshold) {
        levelTouched = true;
        touchTimestamp = st.timestamps[i] ?? Date.now();
        break;
      }
    }
  }

  // S/R Alert Type
  let srAlertType: "none" | "approaching" | "touched" | "breaking" = "none";
  if (levelTouched) {
    srAlertType = "touched";
  } else if (isApproaching && proximity > 0.3) {
    srAlertType = "approaching";
  } else if (isApproaching) {
    srAlertType = "approaching";
  }

  // Multi-timeframe confluence for S/R level
  let tfConfluence = 0;
  const prices30m = candlePrices(candleMap30m, key);
  const prices60m = candlePrices(candleMap60m, key);
  const prices120m = candlePrices(candleMap120m, key);
  if (prices30m.length > 10) {
    const { nearestSupport: s30, nearestResistance: r30 } = findRealSR(prices30m, currentPrice);
    const ref30m = isBoom ? s30?.price : r30?.price;
    if (ref30m && Math.abs(ref30m - refLevel) / refLevel < 0.005) tfConfluence++;
  }
  if (prices60m.length > 10) {
    const { nearestSupport: s60, nearestResistance: r60 } = findRealSR(prices60m, currentPrice);
    const ref60m = isBoom ? s60?.price : r60?.price;
    if (ref60m && Math.abs(ref60m - refLevel) / refLevel < 0.005) tfConfluence++;
  }
  if (prices120m.length > 10) {
    const { nearestSupport: s120, nearestResistance: r120 } = findRealSR(prices120m, currentPrice);
    const ref120m = isBoom ? s120?.price : r120?.price;
    if (ref120m && Math.abs(ref120m - refLevel) / refLevel < 0.005) tfConfluence++;
  }

  // S/R confidence score
  const approachScore = isApproaching ? Math.min(approachVelocity * 2, 0.3) : 0;
  const proximityScore = proximity * 0.4;
  const strengthScore = Math.min(refStrength / 10, 1) * 0.3;
  const tfScore = tfConfluence * 0.1;
  const srConfidence = Math.min(proximityScore + strengthScore + approachScore + tfScore, 1);

  // === PROBABILITY SCORE ===
  const levelStrengthScore = Math.min(refStrength / 8, 1) * 0.3;
  const recentMoves = history.slice(-15).map((p, i, arr) => i > 0 ? p - arr[i - 1] : 0).slice(1);
  const consecFiltered = recentMoves.slice(-5).filter(m => isUp ? m < 0 : m > 0);
  const consecutive = consecFiltered.length;
  const exhaustion = consecutive >= 4 ? 0.2 : 0;

  let marketScore = 0;
  if (isUp && market.trend === "uptrend") marketScore = 0.12;
  else if (!isUp && market.trend === "downtrend") marketScore = 0.12;
  else if (market.trend === "ranging") marketScore = 0.06;
  if (isUp && market.liquiditySwept && market.lastBreakout === "bullish") marketScore += 0.08;
  else if (!isUp && market.liquiditySwept && market.lastBreakout === "bearish") marketScore += 0.08;

  let rsiScore = 0;
  if (isUp && rsiVal < 30) rsiScore = 0.12;
  else if (!isUp && rsiVal > 70) rsiScore = 0.12;
  else if (isUp && rsiVal < 40) rsiScore = 0.06;
  else if (!isUp && rsiVal > 60) rsiScore = 0.06;

  const obBonus = bestOB ? Math.min(bestOB.strength / 5, 1) * 0.08 : 0;
  const bestScore = Math.min(srConfidence * 0.35 + marketScore + rsiScore + levelStrengthScore * 0.3 + exhaustion + obBonus, 1);

  const msSinceLastSpike = Date.now() - st.lastSpikeTime;
  let probability = Math.min(Math.max(bestScore * 100, 20), 97);

  // Multi-timeframe score alignment
  if (prices30m.length > 10) {
    const market30m = analyzeMarketStructure(prices30m);
    const ref30mInfo = getReferenceLevel(type, prices30m, currentPrice);
    const ref30m = ref30mInfo.refLevel;
    const str30m = ref30mInfo.refStrength;
    const d30 = Math.abs(currentPrice - ref30m) / (ref30m || currentPrice);
    const p30 = Math.max(0, 1 - d30 / 0.02);
    const ms30 = isUp && market30m.trend === "uptrend" ? 1 : (!isUp && market30m.trend === "downtrend" ? 1 : 0.5);
    const score30 = p30 * 0.25 + Math.min(str30m / 8, 1) * 0.3 + ms30 * 0.12;
    if (score30 > 0.5) probability += 6;
    else probability -= 4;
  }
  if (prices60m.length > 10) {
    const market60m = analyzeMarketStructure(prices60m);
    const ref60mInfo = getReferenceLevel(type, prices60m, currentPrice);
    const ref60m = ref60mInfo.refLevel;
    const str60m = ref60mInfo.refStrength;
    const d60 = Math.abs(currentPrice - ref60m) / (ref60m || currentPrice);
    const p60 = Math.max(0, 1 - d60 / 0.02);
    const ms60 = isUp && market60m.trend === "uptrend" ? 1 : (!isUp && market60m.trend === "downtrend" ? 1 : 0.5);
    const score60 = p60 * 0.25 + Math.min(str60m / 8, 1) * 0.3 + ms60 * 0.12;
    if (score60 > 0.5) probability += 4;
    else probability -= 3;
  }
  if (prices120m.length > 10) {
    const market120m = analyzeMarketStructure(prices120m);
    const ref120mInfo = getReferenceLevel(type, prices120m, currentPrice);
    const ref120m = ref120mInfo.refLevel;
    const str120m = ref120mInfo.refStrength;
    const d120 = Math.abs(currentPrice - ref120m) / (ref120m || currentPrice);
    const p120 = Math.max(0, 1 - d120 / 0.02);
    const ms120 = isUp && market120m.trend === "uptrend" ? 1 : (!isUp && market120m.trend === "downtrend" ? 1 : 0.5);
    const score120 = p120 * 0.25 + Math.min(str120m / 8, 1) * 0.3 + ms120 * 0.12;
    if (score120 > 0.5) probability += 3;
    else probability -= 2;
  }

  const spikeProb = spikeProbability(st.spikeIntervalModel, msSinceLastSpike, 60000);
  if (st.spikeIntervalModel.ready && st.spikeIntervalModel.sampleSize >= 3) {
    const hazard = st.spikeIntervalModel.shape / Math.max(st.spikeIntervalModel.scale, 1);
    const threshold = Math.min(1 - Math.exp(-hazard * 60), 0.8);
    if (spikeProb > threshold) probability += 8;
    else if (spikeProb < threshold * 0.5) probability -= 5;
    else probability += 2;
  } else {
    const timeFactor = Math.min(msSinceLastSpike / (30 * 60 * 1000), 1);
    probability += Math.round(timeFactor * 5);
  }
  probability = Math.min(Math.max(probability, 0), 97);

  let advancedBonus = 0;
  try {
    const adv = computeAdvancedFeatures(history);
    if (adv.compositeScore > 0.6) advancedBonus = 0.06;
    else if (adv.compositeScore > 0.4) advancedBonus = 0.03;
    if (adv.waveletSpikeScore > 0.5) advancedBonus += 0.03;
    if (adv.fourierSpikeScore > 0.5) advancedBonus += 0.02;
  } catch (e) {}
  probability = Math.min(probability + advancedBonus * 100, 97);

  const volScale = vol > 0 ? Math.max((vol / (currentPrice || 1)) / 0.0005, 0.5) : 1;
  const atrPercent = vol / (currentPrice || 1);

  // === SQUEEZE DETECTION (prix au plus bas/haut avant le spike) ===
  // Pattern: le prix touche le point extrême (bas pour Boom, haut pour Crash)
  // et reste là pendant des dizaines de ticks avant le spike
  const squeezeLookback = Math.min(history.length, 300);
  const squeezeRecent = history.slice(-squeezeLookback);
  const squeezeHigh = Math.max(...squeezeRecent);
  const squeezeLow = Math.min(...squeezeRecent);
  const squeezeRangePct = squeezeHigh > 0 ? (squeezeHigh - squeezeLow) / squeezeHigh : 0;
  // L'extrême recherché : le point le plus bas pour Boom, le plus haut pour Crash
  const targetExtreme = isBoom ? squeezeLow : squeezeHigh;
  const threshold = currentPrice * 0.001; // 0.1% de l'extrême
  let squeezeDuration = 0;
  for (let i = squeezeRecent.length - 1; i >= 0; i--) {
    const dist = Math.abs(squeezeRecent[i] - targetExtreme);
    if (dist <= threshold) {
      squeezeDuration++;
    } else if (squeezeDuration < 10) {
      squeezeDuration = 0; // Réinitialiser si pas assez de continuité
    } else break;
  }
  // Score basé sur la durée à l'extrême et l'étroitesse du range global
  const rangeFactor = squeezeRangePct < 0.005 ? 1 : squeezeRangePct < 0.01 ? 0.6 : 0.2;
  const squeezeScore = Math.min(
    rangeFactor * Math.min(squeezeDuration / 60, 1),
  1);
  const isSqueezing = squeezeDuration >= 30 && rangeFactor >= 0.6;

  let slMultiplier = 0.6;
  let tpMultiplier = 1.8;
  if (atrPercent > 0.002) { slMultiplier *= 1.2; tpMultiplier *= 1.3; }
  else if (atrPercent < 0.0005) { slMultiplier *= 0.8; tpMultiplier *= 0.7; }
  // Longer SL/TP during squeeze (spike tends to be stronger after long consolidation)
  if (isSqueezing) { slMultiplier *= 1.3; tpMultiplier *= 1.5; }

  const lookback = Math.min(history.length, 100);
  const recentHigh = Math.max(...history.slice(-lookback));
  const recentLow = Math.min(...history.slice(-lookback));
  const recentRange = currentPrice > 0 ? (recentHigh - recentLow) / currentPrice : 0.005;
  const magnitudePct = (0.008 + bestScore * 0.04) * (recentRange / 0.005) * volScale;
  const magnitudeStr = `${(magnitudePct * 100).toFixed(1)}%`;

  const pricePos = nearestSupport && nearestResistance
    ? Math.round(((currentPrice - nearestSupport.price) / (nearestResistance.price - nearestSupport.price)) * 100)
    : 50;

  const expDir = isBoom ? "up" : "down";

  // === ANALYSE QUOTIDIENNE (tendance et dernier retournement) ===
  const dailyPrices = candlePrices(candleMap120m, key);
  let dailyTrend: "hausse" | "baisse" | "neutre" = "neutre";
  let lastReversalPrice = 0;
  let lastReversalType: "support" | "resistance" | null = null;
  let dailyTrendScore = 0;
  if (dailyPrices.length >= 8) {
    // Tendance sur les 6 dernières bougies 2h (= 12h de trading)
    const daySlice = dailyPrices.slice(-8);
    const dayStart = daySlice[0];
    const dayEnd = daySlice[daySlice.length - 1];
    const dayChange = dayStart > 0 ? (dayEnd - dayStart) / dayStart : 0;
    if (dayChange > 0.005) dailyTrend = "hausse";
    else if (dayChange < -0.005) dailyTrend = "baisse";
    // Dernier pivot sur le 2h (= dernier retournement significatif)
    const dayPivots = findPivots(daySlice, 3);
    const dayHighs = dayPivots.filter(p => p.isHigh).sort((a, b) => b.price - a.price);
    const dayLows = dayPivots.filter(p => !p.isHigh).sort((a, b) => a.price - b.price);
    // Le dernier retournement : le pivot le plus récent (le plus proche de la fin)
    const recentPivot = dayPivots.length > 0
      ? dayPivots.reduce((a, b) => Math.abs(a.price - dayEnd) < Math.abs(b.price - dayEnd) ? a : b)
      : null;
    if (recentPivot) {
      lastReversalPrice = recentPivot.price;
      lastReversalType = recentPivot.isHigh ? "resistance" : "support";
    }
    // Score : le spike dans la direction de la tendance quotidienne est plus fiable
    if ((isBoom && dailyTrend === "hausse") || (!isBoom && dailyTrend === "baisse")) {
      dailyTrendScore = 8; // Spike dans le sens de la tendance du jour
    } else if (dailyTrend === "neutre") {
      dailyTrendScore = 3;
    } else {
      dailyTrendScore = -5; // Spike à contre-tendance = moins fiable
    }
    probability = Math.min(probability + dailyTrendScore, 97);
  }

  // Squeeze probability boost
  if (isSqueezing) {
    probability = Math.min(probability + squeezeScore * 25, 97);
  }

  // === HIGH-QUALITY SIGNAL FILTERS ===
  const perfKey = `${type}_${num}`;
  const perfStats = signalPerformance.get(perfKey) || { total: 0, wins: 0, recentAccuracy: 0.55 };
  const adaptiveBase = 0.55 + (perfStats.recentAccuracy - 0.5) * 0.3;
  const strBuyThreshold = Math.min(75 + (1 - adaptiveBase) * 20, 88);
  const buyThreshold = Math.min(68 + (1 - adaptiveBase) * 20, 82);

  // Strict filters: only signal when level is touched + TF confluence + min volatility
  const signalCooldownMs = 6 * 60 * 60 * 1000; // 6h between signals per market (~max 1-2 signaux par jour)
  const timeSincePrevSignal = Date.now() - st.prevSignalTime;
  const minVolScale = 0.8;
  const minTfConfluence = Math.min(tfConfluence, 3);

  // Un signal à contre-tendance quotidienne nécessite une probabilité bien plus élevée
  const effectiveBuyThreshold = dailyTrendScore < 0 ? buyThreshold + 10 : buyThreshold;
  const effectiveStrBuyThreshold = dailyTrendScore < 0 ? strBuyThreshold + 8 : strBuyThreshold;

  const passesQualityFilters =
    timeSincePrevSignal >= signalCooldownMs &&
    history.length >= 100 &&
    dailyTrendScore >= 0 && // Jamais de signal à contre-tendance du jour
    (
      // Normal path : niveau touché + confluence TF + volatilité suffisante
      (levelTouched && tfConfluence >= 2 && volScale >= minVolScale) ||
      // Squeeze path : longue consolidation + squeeze score élevé (volatilité va exploser)
      (isSqueezing && squeezeScore >= 0.5 && probability >= effectiveBuyThreshold)
    );

  let signal: Signal = "NEUTRAL";
  if (passesQualityFilters) {
    if (probability >= effectiveStrBuyThreshold) signal = isBoom ? "STRONG_BUY" : "STRONG_SELL";
    else if (probability >= effectiveBuyThreshold) signal = isBoom ? "BUY" : "SELL";
  }

  const predictive = isApproaching && !levelTouched;
  const slDistance = Math.max(vol * slMultiplier, currentPrice * 0.002);
  const tpDistance = Math.max(vol * tpMultiplier, slDistance * 2);

  const dynamicSupport = nearestSupport?.price ?? currentPrice * 0.99;
  const dynamicResistance = nearestResistance?.price ?? currentPrice * 1.01;

  let entryLevel: number;
  if (predictive) {
    entryLevel = isBoom
      ? currentPrice * (1 - Math.min(atrPercent * 0.5, 0.002))
      : currentPrice * (1 + Math.min(atrPercent * 0.5, 0.002));
  } else if (levelTouched) {
    entryLevel = isBoom
      ? Math.min(dynamicSupport, currentPrice * 0.998)
      : Math.max(dynamicResistance, currentPrice * 1.002);
  } else {
    entryLevel = isBoom
      ? Math.min(dynamicSupport * 0.999, currentPrice * (1 - atrPercent * 0.3))
      : Math.max(dynamicResistance * 1.001, currentPrice * (1 + atrPercent * 0.3));
  }

  const stopLoss = isBoom
    ? Math.min(entryLevel - slDistance, dynamicSupport * (1 - atrPercent))
    : Math.max(entryLevel + slDistance, dynamicResistance * (1 + atrPercent));

  const takeProfit = isBoom
    ? Math.max(entryLevel + tpDistance, currentPrice + tpDistance)
    : Math.min(entryLevel - tpDistance, currentPrice - tpDistance);

  let isConfirmed = false;
  let confirmationPrice: number | null = null;
  if (signal !== "NEUTRAL") {
    const prevSig = st.prevSignal;
    const isBuy = isBoom;
    const currentSig = isBuy ? (signal === "STRONG_BUY" ? "STRONG_BUY" : "BUY") : (signal === "STRONG_SELL" ? "STRONG_SELL" : "SELL");
    if (prevSig !== currentSig) {
      st.prevSignal = currentSig;
      st.prevSignalPrice = currentPrice;
      st.prevSignalTime = Date.now();
      st.confirmationTriggered = false;
    }
    const priceChange = (currentPrice - st.prevSignalPrice) / st.prevSignalPrice;
    const confirmThreshold = Math.max(vol / currentPrice * 0.5, 0.0008);
    if (!st.confirmationTriggered) {
      if (isBuy && priceChange >= confirmThreshold) {
        isConfirmed = true; confirmationPrice = currentPrice; st.confirmationTriggered = true;
      } else if (!isBuy && priceChange <= -confirmThreshold) {
        isConfirmed = true; confirmationPrice = currentPrice; st.confirmationTriggered = true;
      }
    } else {
      isConfirmed = true; confirmationPrice = st.prevSignalPrice;
    }
  }

  const bestRef = bestOB
    ? { level: bestOB.price, strength: bestOB.strength }
    : { level: refLevel, strength: refStrength };

  // === S/R ALERT ===
  const hasSRLevel = nearestSupport !== null || nearestResistance !== null;
  const srAlert: SRAlert = {
    hasSRLevel,
    levelPrice: Math.round(refLevel * 100) / 100,
    levelStrength: refStrength,
    levelType: refType,
    distancePercent: Math.round(distanceToRef * 10000) / 100,
    isApproaching,
    approachVelocity: Math.round(approachVelocity * 100) / 100,
    approachAcceleration: Math.round(approachAcceleration * 100) / 100,
    levelTouched,
    touchTimestamp,
    srAlertType,
    srConfidence: Math.round(srConfidence * 100),
    tfConfluence,
  };

  return {
    type, number: num, currentPrice,
    spikeProbability: Math.round(Math.min(probability, 97)),
    expectedDirection: expDir,
    estimatedMagnitude: magnitudeStr,
    timeSinceLastSpike: Math.round(msSinceLastSpike / 1000),
    isSpikeImminent: passesQualityFilters && probability >= 80,
    isSqueezing, squeezeScore: Math.round(squeezeScore * 100) / 100,
    squeezeDuration,
    dailyTrend, dailyTrendScore, lastReversalPrice: Math.round(lastReversalPrice * 100) / 100, lastReversalType,
    levelTouched, isApproaching,
    approachVelocity: Math.round(approachVelocity * 100) / 100,
    volScale: Math.round(volScale * 100) / 100,
    pricePosition: pricePos,
    consecutiveMoves: consecutive,
    rangeLow: nearestSupport?.price ?? currentPrice * 0.98,
    rangeHigh: nearestResistance?.price ?? currentPrice * 1.02,
    referenceLevel: Math.round(bestRef.level * 100) / 100,
    referenceStrength: bestRef.strength,
    distancePercent: Math.round(Math.abs(currentPrice - bestRef.level) / (bestRef.level || currentPrice) * 10000) / 100,
    sRlevels: allLevels.slice(0, 6).map(l => ({ price: Math.round(l.price * 100) / 100, strength: l.strength, type: l.type })),
    orderBlocks: orderBlocks.slice(0, 4).map(ob => ({ price: Math.round(ob.price * 100) / 100, type: ob.type, strength: ob.strength })),
    upScore: Math.round(bestScore * 100),
    downScore: Math.round((1 - bestScore) * 100),
    connected: st.connected, timestamp: Date.now(),
    signal, entryPrice: Math.round(entryLevel * 100) / 100,
    stopLoss: Math.round(stopLoss * 100) / 100,
    takeProfit: Math.round(takeProfit * 100) / 100,
    isConfirmed, confirmationPrice: confirmationPrice ? Math.round(confirmationPrice * 100) / 100 : null,
    srAlert,
  };
}

export function predictNextTick(type: IndexType, num: number) {
  const key = getKey(type, num);
  const st = stateMap.get(key);
  if (!st || st.history.length < 10) {
    return { error: "Pas assez de données historiques" };
  }

  const history = st.history;
  const recent = history.slice(-30);
  const changes = recent.map((p, i, arr) => i > 0 ? p - arr[i - 1] : 0).slice(1);

  const avgChange = changes.reduce((a, b) => a + b, 0) / (changes.length || 1);
  const variance = changes.reduce((a, b) => a + b * b, 0) / (changes.length || 1);
  const volatility = Math.sqrt(variance);

  const rand = Math.random();
  const prediction = rand > 0.5 ? "UP" : "DOWN";
  const confidence = Math.min(Math.abs(avgChange) / (volatility || 1) * 0.5 + 0.5, 0.95);

  return {
    type,
    number: num,
    currentPrice: st.price,
    prediction,
    confidence: Math.round(confidence * 100),
    connected: st.connected,
    timestamp: Date.now(),
  };
}

export function getCandlesticks(type: IndexType, num: number): Candlestick[] {
  return candleMap15m.get(getKey(type, num)) || [];
}

export function getCandlesticksByTF(type: IndexType, num: number, tf: "15m" | "30m" | "1h" | "2h"): Candlestick[] {
  const key = getKey(type, num);
  const map = tf === "30m" ? candleMap30m : tf === "1h" ? candleMap60m : tf === "2h" ? candleMap120m : candleMap15m;
  return map.get(key) || [];
}

export interface MarketOpportunity {
  type: IndexType;
  number: number;
  label: string;
  currentPrice: number;
  change24h: number;
  spikeProbability: number;
  expectedDirection: "up" | "down";
  estimatedMagnitude: string;
  isSpikeImminent: boolean;
  levelTouched?: boolean;
  isApproaching?: boolean;
  approachVelocity?: number;
  timeSinceLastSpike: number;
  pricePosition: number;
  consecutiveMoves: number;
  referenceLevel: number;
  referenceStrength: number;
  distancePercent: number;
  upScore: number;
  downScore: number;
  sRlevels: { price: number; strength: number; type: "support" | "resistance" }[];
  orderBlocks: { price: number; type: "bullish" | "bearish"; strength: number }[];
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  volScale?: number;
  connected: boolean;
  timestamp: number;
  srAlert?: SRAlert;
  indicators?: any;
}

export interface MarketScanResult {
  timestamp: number;
  source: "deriv-live" | "disconnected";
  opportunities: MarketOpportunity[];
  bestOpportunity: MarketOpportunity | null;
  imminentCount: number;
  totalAnalyzed: number;
}

export function scanAllMarkets(): MarketScanResult {
  const opportunities: MarketOpportunity[] = [];

  for (const idx of INDICES) {
    const key = getKey(idx.type, idx.number);
    const st = stateMap.get(key);
    if (!st || st.history.length < 30) continue;

    const prediction = predictSpike(idx.type, idx.number);
    if (!prediction || "error" in prediction) continue;

    const label = `${idx.type === "BOOM" ? "Boom" : "Crash"} ${idx.number}`;

    opportunities.push({
      type: idx.type,
      number: idx.number,
      label,
      currentPrice: prediction.currentPrice,
      change24h: st.change24h,
      spikeProbability: prediction.spikeProbability,
      expectedDirection: prediction.expectedDirection as "up" | "down",
      estimatedMagnitude: prediction.estimatedMagnitude,
      isSpikeImminent: prediction.isSpikeImminent,
      levelTouched: prediction.levelTouched,
      isApproaching: prediction.isApproaching,
      approachVelocity: prediction.approachVelocity,
      timeSinceLastSpike: prediction.timeSinceLastSpike,
      pricePosition: prediction.pricePosition,
      consecutiveMoves: prediction.consecutiveMoves,
      referenceLevel: prediction.referenceLevel,
      referenceStrength: prediction.referenceStrength,
      distancePercent: prediction.distancePercent,
      upScore: prediction.upScore,
      downScore: prediction.downScore,
      sRlevels: prediction.sRlevels,
      orderBlocks: prediction.orderBlocks,
      entryPrice: prediction.entryPrice,
      stopLoss: prediction.stopLoss,
      takeProfit: prediction.takeProfit,
      volScale: prediction.volScale,
      connected: prediction.connected,
      timestamp: prediction.timestamp,
      srAlert: prediction.srAlert,
    });
  }

  opportunities.sort((a, b) => b.spikeProbability - a.spikeProbability);

  return {
    timestamp: Date.now(),
    source: wsConnected ? "deriv-live" : "disconnected",
    opportunities,
    bestOpportunity: opportunities.length > 0 ? opportunities[0] : null,
    imminentCount: opportunities.filter(o => o.isSpikeImminent).length,
    totalAnalyzed: opportunities.length,
  };
}

export function initDerivClient() {
  if (typeof window === "undefined") return false;
  return connectDerivWebSocket();
}
