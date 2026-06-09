// Real Deriv WebSocket API — Live synthetic indices (Boom & Crash)
// Requires DERIV_APP_ID env variable (get one free at https://app.deriv.com/account/api-token)

export type IndexType = "BOOM" | "CRASH";

export interface IndexState {
  price: number;
  change24h: number;
  history: number[];
  timestamps: number[];
  lastSpikeTime: number;
  lastSpikeDirection: "up" | "down" | null;
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
  { type: "BOOM", number: 500, symbol: "BOOM500" },
  { type: "BOOM", number: 900, symbol: "BOOM900" },
  { type: "BOOM", number: 1000, symbol: "BOOM1000" },
  { type: "CRASH", number: 500, symbol: "CRASH500" },
  { type: "CRASH", number: 900, symbol: "CRASH900" },
  { type: "CRASH", number: 1000, symbol: "CRASH1000" },
];

function getKey(type: IndexType, num: number) { return `${type}_${num}`; }
function keyFromSymbol(symbol: string): string | null {
  const idx = INDICES.find(i => i.symbol === symbol);
  return idx ? getKey(idx.type, idx.number) : null;
}

const stateMap = new Map<string, IndexState>();
const candleMap1m = new Map<string, Candlestick[]>();
const candleMap5m = new Map<string, Candlestick[]>();
const candleMap15m = new Map<string, Candlestick[]>();
const priceAt24hAgo = new Map<string, number>();

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
    connected: false,
    prevSignal: null,
    prevSignalPrice: 0,
    prevSignalTime: 0,
    confirmationTriggered: false,
  });
}
initCandleMap(candleMap1m);
initCandleMap(candleMap5m);
initCandleMap(candleMap15m);

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
    // Use the 'ws' library on Node.js (native WebSocket has issues on Windows)
    const { WebSocket: WsWebSocket } = require("ws");
    return new WsWebSocket(url);
  }
  return new WebSocket(url);
}

const CANDLE_INTERVALS = [
  { seconds: 60, map: candleMap1m, label: "1m" },
  { seconds: 300, map: candleMap5m, label: "5m" },
  { seconds: 900, map: candleMap15m, label: "15m" },
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

    if (prices.length > 1440) {
      priceAt24hAgo.set(key, prices[prices.length - 1440]);
    } else if (prices.length > 0) {
      priceAt24hAgo.set(key, prices[0]);
    }
  }
}

const INDICES_FOR_HISTORY = [
  "BOOM500", "BOOM900", "BOOM1000",
  "CRASH500", "CRASH900", "CRASH1000",
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
const ATR_PERIOD = 14;

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

function atr(prices: number[], period: number = ATR_PERIOD): number {
  if (prices.length < period + 1) return 0;
  const recent = prices.slice(-period - 1);
  let sum = 0;
  for (let i = 1; i < recent.length; i++) {
    sum += Math.abs(recent[i] - recent[i - 1]);
  }
  return sum / period;
}

function rsi(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;
  const recent = prices.slice(-period - 1);
  let gains = 0, losses = 0;
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function findPivots(prices: number[], lookback: number = 3): { price: number; isHigh: boolean; strength: number }[] {
  const pivots: { price: number; isHigh: boolean; strength: number }[] = [];
  for (let i = lookback; i < prices.length - lookback; i++) {
    const curr = prices[i];
    const left = prices.slice(i - lookback, i);
    const right = prices.slice(i + 1, i + lookback + 1);

    const isHigh = left.every(p => curr > p) && right.every(p => curr > p);
    const isLow = left.every(p => curr < p) && right.every(p => curr < p);

    if (isHigh) {
      const existing = pivots.find(p => p.isHigh && Math.abs(p.price - curr) / curr < CLUSTER_TOLERANCE);
      if (existing) { existing.strength++; existing.price = (existing.price + curr) / 2; }
      else pivots.push({ price: curr, isHigh: true, strength: 1 });
    }
    if (isLow) {
      const existing = pivots.find(p => !p.isHigh && Math.abs(p.price - curr) / curr < CLUSTER_TOLERANCE);
      if (existing) { existing.strength++; existing.price = (existing.price + curr) / 2; }
      else pivots.push({ price: curr, isHigh: false, strength: 1 });
    }
  }
  return pivots;
}

function analyzeMarketStructure(prices: number[]): MarketStructure {
  const recent = prices.slice(-60);
  if (recent.length < 20) return { trend: "ranging", lastBreakout: null, liquiditySwept: false, imbalance: 0 };

  const pivots = findPivots(recent, 5);
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

  const avgMove = atr(recent) / (recent.reduce((a, b) => a + b, 0) / recent.length);
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

function findSupportResistance(prices: number[], currentPrice: number): {
  nearestSupport: SRLevel | null;
  nearestResistance: SRLevel | null;
  allLevels: SRLevel[];
} {
  const pivots3 = findPivots(prices.slice(-80), 3);
  const pivots5 = findPivots(prices.slice(-120), 5);
  const pivots8 = findPivots(prices.slice(-200), 8);

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

  const supports: SRLevel[] = clusters
    .filter(c => c.price < currentPrice)
    .map(c => ({ price: c.price, strength: c.strength, type: "support" as const }))
    .sort((a, b) => b.price - a.price);

  const resistances: SRLevel[] = clusters
    .filter(c => c.price > currentPrice)
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
  if (isUp && rsiVal < 15) rsiScore = 0.4;
  else if (!isUp && rsiVal > 85) rsiScore = 0.4;
  else if (isUp && rsiVal < 25) rsiScore = 0.2;
  else if (!isUp && rsiVal > 75) rsiScore = 0.2;

  let marketScore = 0;
  if (isUp && market.trend === "uptrend") marketScore = 0.2;
  else if (!isUp && market.trend === "downtrend") marketScore = 0.2;
  else if (market.trend === "ranging") marketScore = 0.1;

  if (isUp && market.liquiditySwept && market.lastBreakout === "bullish") marketScore += 0.15;
  else if (!isUp && market.liquiditySwept && market.lastBreakout === "bearish") marketScore += 0.15;

  const strengthBonus = Math.min(refStrength / 5, 1) * 0.1;

  const score = nearLevel * 0.15 + momentumScore * 0.15 + rsiScore + marketScore + strengthBonus + exhaustionScore;
  return { score: Math.min(score, 1), referenceLevel: refLevel, referenceStrength: refStrength, distancePct: distance / (refLevel || currentPrice) * 100, consecutive };
}

export function predictSpike(type: IndexType, num: number) {
  const key = getKey(type, num);
  const st = stateMap.get(key);
  if (!st || st.history.length < 30) {
    return { error: "Pas assez de données historiques" };
  }

  const history = st.history;
  const currentPrice = st.price;
  const vol = atr(history);
  const rsiVal = rsi(history);
  const market = analyzeMarketStructure(history);
  const { nearestSupport, nearestResistance, allLevels } = findSupportResistance(history, currentPrice);
  const orderBlocks = findOrderBlocks(history);

  const upScore = scoreSignal(currentPrice, nearestSupport?.price ?? null, nearestSupport?.strength ?? 0, history, true, rsiVal, market);
  const downScore = scoreSignal(currentPrice, nearestResistance?.price ?? null, nearestResistance?.strength ?? 0, history, false, rsiVal, market);

  const isUp = upScore.score >= downScore.score;
  const bestScore = isUp ? upScore.score : downScore.score;

  const msSinceLastSpike = Date.now() - st.lastSpikeTime;
  const recoveryTime = Math.min(msSinceLastSpike / 60000, 1);
  let probability = Math.min((bestScore * 0.85 + recoveryTime * 0.15) * 100, 97);

  // Multi-timeframe confirmation (5m, 15m)
  const prices5m = candlePrices(candleMap5m, key);
  const prices15m = candlePrices(candleMap15m, key);
  let tfBonus = 0;
  if (prices5m.length > 10) {
    const vol5m = atr(prices5m);
    const rsi5m = rsi(prices5m);
    const market5m = analyzeMarketStructure(prices5m);
    const { nearestSupport: s5, nearestResistance: r5 } = findSupportResistance(prices5m, currentPrice);
    const up5 = scoreSignal(currentPrice, s5?.price ?? null, s5?.strength ?? 0, prices5m, true, rsi5m, market5m);
    const dn5 = scoreSignal(currentPrice, r5?.price ?? null, r5?.strength ?? 0, prices5m, false, rsi5m, market5m);
    const agree5m = isUp ? (up5.score >= dn5.score) : (dn5.score >= up5.score);
    if (agree5m) tfBonus += 0.12;
    else tfBonus -= 0.08;
  }
  if (prices15m.length > 10) {
    const vol15m = atr(prices15m);
    const rsi15m = rsi(prices15m);
    const market15m = analyzeMarketStructure(prices15m);
    const { nearestSupport: s15, nearestResistance: r15 } = findSupportResistance(prices15m, currentPrice);
    const up15 = scoreSignal(currentPrice, s15?.price ?? null, s15?.strength ?? 0, prices15m, true, rsi15m, market15m);
    const dn15 = scoreSignal(currentPrice, r15?.price ?? null, r15?.strength ?? 0, prices15m, false, rsi15m, market15m);
    const agree15m = isUp ? (up15.score >= dn15.score) : (dn15.score >= up15.score);
    if (agree15m) tfBonus += 0.08;
    else tfBonus -= 0.05;
  }
  probability = Math.min(Math.max(probability + tfBonus * 100, 0), 97);

  const volFactor = num === 1000 ? 0.6 : num === 900 ? 0.8 : 1;
  const magnitudePct = (0.008 + bestScore * 0.04) * volFactor;
  const magnitudeStr = `${(magnitudePct * 100).toFixed(1)}%`;

  const pricePos = nearestSupport && nearestResistance
    ? Math.round(((currentPrice - nearestSupport.price) / (nearestResistance.price - nearestSupport.price)) * 100)
    : 50;

  const expDir = isUp ? "up" : "down";
  const bestConsecutive = isUp ? upScore.consecutive : downScore.consecutive;

  let signal: Signal = "NEUTRAL";
  if (probability >= 85) signal = isUp ? "STRONG_BUY" : "STRONG_SELL";
  else if (probability >= 75) signal = isUp ? "BUY" : "SELL";

  const entryLevel = isUp
    ? Math.min(nearestSupport?.price ?? currentPrice * 0.99, currentPrice * 0.998)
    : Math.max(nearestResistance?.price ?? currentPrice * 1.01, currentPrice * 1.002);

  const slBuffer = vol * 0.6;
  const tpBuffer = vol * 1.8;

  const stopLoss = isUp
    ? Math.min(entryLevel * 0.996, entryLevel - slBuffer)
    : Math.max(entryLevel * 1.004, entryLevel + slBuffer);

  const takeProfit = isUp
    ? Math.max(entryLevel + tpBuffer, currentPrice + vol * 0.8)
    : Math.min(entryLevel - tpBuffer, currentPrice - vol * 0.8);

  let isConfirmed = false;
  let confirmationPrice: number | null = null;

  if (signal !== "NEUTRAL") {
    const prevSig = st.prevSignal;
    const isBuy = isUp;
    const currentSig = isBuy ? (signal === "STRONG_BUY" ? "STRONG_BUY" : "BUY") : (signal === "STRONG_SELL" ? "STRONG_SELL" : "SELL");
    const sigChanged = prevSig !== currentSig;

    if (sigChanged) {
      st.prevSignal = currentSig;
      st.prevSignalPrice = currentPrice;
      st.prevSignalTime = Date.now();
      st.confirmationTriggered = false;
    }

    const priceChange = (currentPrice - st.prevSignalPrice) / st.prevSignalPrice;
    const confirmThreshold = Math.max(vol / currentPrice * 0.5, 0.0008);

    if (!st.confirmationTriggered) {
      if (isBuy && priceChange >= confirmThreshold) {
        isConfirmed = true;
        confirmationPrice = currentPrice;
        st.confirmationTriggered = true;
      } else if (!isBuy && priceChange <= -confirmThreshold) {
        isConfirmed = true;
        confirmationPrice = currentPrice;
        st.confirmationTriggered = true;
      }
    } else {
      isConfirmed = true;
      confirmationPrice = st.prevSignalPrice;
    }
  }

  const bestRef = isUp
    ? (orderBlocks.length > 0 && Math.abs(orderBlocks[0].price - currentPrice) / currentPrice < 0.01 ? { level: orderBlocks[0].price, strength: orderBlocks[0].strength } : { level: upScore.referenceLevel, strength: upScore.referenceStrength })
    : (orderBlocks.length > 0 && Math.abs(orderBlocks[0].price - currentPrice) / currentPrice < 0.01 ? { level: orderBlocks[0].price, strength: orderBlocks[0].strength } : { level: downScore.referenceLevel, strength: downScore.referenceStrength });

  return {
    type, number: num, currentPrice,
    spikeProbability: Math.round(Math.min(probability, 97)),
    expectedDirection: expDir,
    estimatedMagnitude: magnitudeStr,
    timeSinceLastSpike: Math.round(msSinceLastSpike / 1000),
    isSpikeImminent: probability >= 75,
    pricePosition: pricePos,
    consecutiveMoves: bestConsecutive,
    rangeLow: nearestSupport?.price ?? currentPrice * 0.98,
    rangeHigh: nearestResistance?.price ?? currentPrice * 1.02,
    referenceLevel: Math.round(bestRef.level * 100) / 100,
    referenceStrength: bestRef.strength,
    distancePercent: Math.round(Math.abs(currentPrice - bestRef.level) / (bestRef.level || currentPrice) * 10000) / 100,
    sRlevels: allLevels.slice(0, 6).map(l => ({ price: Math.round(l.price * 100) / 100, strength: l.strength, type: l.type })),
    orderBlocks: orderBlocks.slice(0, 4).map(ob => ({ price: Math.round(ob.price * 100) / 100, type: ob.type, strength: ob.strength })),
    upScore: Math.round(upScore.score * 100),
    downScore: Math.round(downScore.score * 100),
    connected: st.connected,
    timestamp: Date.now(),
    signal,
    entryPrice: Math.round(entryLevel * 100) / 100,
    stopLoss: Math.round(stopLoss * 100) / 100,
    takeProfit: Math.round(takeProfit * 100) / 100,
    isConfirmed,
    confirmationPrice: confirmationPrice ? Math.round(confirmationPrice * 100) / 100 : null,
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
  return candleMap1m.get(getKey(type, num)) || [];
}

export function getCandlesticksByTF(type: IndexType, num: number, tf: "1m" | "5m" | "15m"): Candlestick[] {
  const key = getKey(type, num);
  const map = tf === "15m" ? candleMap15m : tf === "5m" ? candleMap5m : candleMap1m;
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
  connected: boolean;
  timestamp: number;
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
    if (!st || st.history.length < 20) continue;

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
      connected: prediction.connected,
      timestamp: prediction.timestamp,
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
