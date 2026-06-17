// Real Deriv WebSocket API — Live synthetic indices (Boom & Crash)
// Requires DERIV_APP_ID env variable (get one free at https://app.deriv.com/account/api-token)

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
  regime?: any;
  candlePatterns?: any[];
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
const candleMap15m = new Map<string, Candlestick[]>();
const candleMap30m = new Map<string, Candlestick[]>();
const candleMap60m = new Map<string, Candlestick[]>();
const candleMap120m = new Map<string, Candlestick[]>();
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
    // Use the 'ws' library on Node.js (native WebSocket has issues on Windows)
    const { WebSocket: WsWebSocket } = require("ws");
    return new WsWebSocket(url);
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

  // --- Nouveaux indicateurs techniques (protégés) ---
  let macdResult: any = null, bbResult: any = null, ichimokuResult: any = null;
  let stochRsi = 50, adx = 25, trendStrength = 0, vwap = 0, vwapDistance = 0;
  let regime = { volatility: "medium" as string, market: "ranging" as string, adx: 25, recommendation: "" };
  let patternSignal = { signal: "neutral" as string, score: 0 };
  let candlePatterns: { name: string; signal: string; strength: number }[] = [];
  try {
    macdResult = calculateMACD(history);
    bbResult = calculateBollingerBands(history);
    ichimokuResult = calculateIchimoku(history);
    stochRsi = calculateStochasticRSI(history);
    adx = calculateADXInternal(history);
    trendStrength = detectTrendStrengthInternal(history);
    regime = analyzeRegimeInternal(history);
    vwap = calculateVWAP(history);
    const candles15m = candleMap15m.get(key) || [];
    candlePatterns = detectCandlestickPatterns(candles15m.map(c => ({ open: c.open, high: c.high, low: c.low, close: c.close })));
    patternSignal = getPatternSignal(candlePatterns);
  } catch (e) {
    if (!isServer) console.warn("[Deriv] Erreur indicateurs techniques:", e);
  }
  // -----------------------------------------------

  // --- Scoring spécifique au type d'indice ---
  // Boom → opportunité à la hausse (support)
  // Crash → opportunité à la baisse (résistance)
  const isBoom = type === "BOOM";
  const isUp = isBoom;
  const refLevel = isBoom
    ? (nearestSupport?.price ?? Math.min(...history.slice(-20)))
    : (nearestResistance?.price ?? Math.max(...history.slice(-20)));
  const refStrength = isBoom
    ? (nearestSupport?.strength ?? 1)
    : (nearestResistance?.strength ?? 1);

  const score = scoreSignal(currentPrice, refLevel, refStrength, history, isUp, rsiVal, market);
  let bestScore = score.score;

  // --- Ajustement par indicateurs techniques ---
  let indicatorBonus = 0;

  // MACD confirmation
  if (macdResult) {
    const macdBullish = macdResult.histogram > 0 && macdResult.macd > macdResult.signal;
    const macdBearish = macdResult.histogram < 0 && macdResult.macd < macdResult.signal;
    if (isBoom && macdBullish) indicatorBonus += 0.05;
    else if (!isBoom && macdBearish) indicatorBonus += 0.05;
    else if (isBoom && macdBearish) indicatorBonus -= 0.03;
    else if (!isBoom && macdBullish) indicatorBonus -= 0.03;
  }

  // Bollinger Bands squeeze/breakout
  if (bbResult) {
    const nearLower = Math.abs(currentPrice - bbResult.lower) / bbResult.lower < 0.005;
    const nearUpper = Math.abs(currentPrice - bbResult.upper) / bbResult.upper < 0.005;
    const squeeze = bbResult.bandwidth < 0.05;
    if (squeeze) indicatorBonus += 0.03;
    if (isBoom && nearLower) indicatorBonus += 0.03;
    if (!isBoom && nearUpper) indicatorBonus += 0.03;
  }

  // Ichimoku confirmation
  if (ichimokuResult) {
    const tenkanAboveKijun = ichimokuResult.tenkan > ichimokuResult.kijun;
    if (isBoom && currentPrice < ichimokuResult.senkouA && tenkanAboveKijun) indicatorBonus += 0.04;
    if (!isBoom && currentPrice > ichimokuResult.senkouA && !tenkanAboveKijun) indicatorBonus += 0.04;
  }

  // StochRSI extrême
  if (isBoom && stochRsi < 20) indicatorBonus += 0.04;
  else if (!isBoom && stochRsi > 80) indicatorBonus += 0.04;
  else if (isBoom && stochRsi > 80) indicatorBonus -= 0.03;
  else if (!isBoom && stochRsi < 20) indicatorBonus -= 0.03;

  // ADX trend strength (Boom: trend up, Crash: trend down)
  if (adx > 25) {
    if (isBoom && trendStrength > 10) indicatorBonus += 0.03;
    else if (!isBoom && trendStrength < -10) indicatorBonus += 0.03;
  }

  // --- Ajustement par patterns de chandeliers ---
  let patternBonus = 0;
  if (isBoom && patternSignal.signal === "bullish") {
    patternBonus = Math.min(patternSignal.score / 20, 0.05);
  } else if (!isBoom && patternSignal.signal === "bearish") {
    patternBonus = Math.min(Math.abs(patternSignal.score) / 20, 0.05);
  } else if (isBoom && patternSignal.signal === "bearish") {
    patternBonus = -0.03;
  } else if (!isBoom && patternSignal.signal === "bullish") {
    patternBonus = -0.03;
  }

  // --- Ajustement par régime de volatilité ---
  let regimeBonus = 0;
  if (isBoom && regime.market === "trending_bull") regimeBonus += 0.03;
  else if (!isBoom && regime.market === "trending_bear") regimeBonus += 0.03;
  else if (regime.market === "volatile") regimeBonus += 0.02;
  else if (regime.market === "calm") regimeBonus -= 0.02;

  bestScore = Math.min(bestScore + indicatorBonus + patternBonus + regimeBonus, 1);

  const msSinceLastSpike = Date.now() - st.lastSpikeTime;
  let probability = Math.min(Math.max(bestScore * 100, 20), 97);

  // Multi-timeframe confirmation (30m, 1h, 2h)
  const prices30m = candlePrices(candleMap30m, key);
  const prices60m = candlePrices(candleMap60m, key);
  const prices120m = candlePrices(candleMap120m, key);
  if (prices30m.length > 10) {
    const rsi30m = rsi(prices30m);
    const market30m = analyzeMarketStructure(prices30m);
    const { nearestSupport: s30, nearestResistance: r30 } = findSupportResistance(prices30m, currentPrice);
    const ref30m = isBoom ? (s30?.price ?? Math.min(...prices30m.slice(-20))) : (r30?.price ?? Math.max(...prices30m.slice(-20)));
    const str30m = isBoom ? (s30?.strength ?? 1) : (r30?.strength ?? 1);
    const score30m = scoreSignal(currentPrice, ref30m, str30m, prices30m, isUp, rsi30m, market30m);
    if (score30m.score > 0.5) probability += 6;
    else probability -= 4;
  }
  if (prices60m.length > 10) {
    const rsi60m = rsi(prices60m);
    const market60m = analyzeMarketStructure(prices60m);
    const { nearestSupport: s60, nearestResistance: r60 } = findSupportResistance(prices60m, currentPrice);
    const ref60m = isBoom ? (s60?.price ?? Math.min(...prices60m.slice(-20))) : (r60?.price ?? Math.max(...prices60m.slice(-20)));
    const str60m = isBoom ? (s60?.strength ?? 1) : (r60?.strength ?? 1);
    const score60m = scoreSignal(currentPrice, ref60m, str60m, prices60m, isUp, rsi60m, market60m);
    if (score60m.score > 0.5) probability += 4;
    else probability -= 3;
  }
  if (prices120m.length > 10) {
    const rsi120m = rsi(prices120m);
    const market120m = analyzeMarketStructure(prices120m);
    const { nearestSupport: s120, nearestResistance: r120 } = findSupportResistance(prices120m, currentPrice);
    const ref120m = isBoom ? (s120?.price ?? Math.min(...prices120m.slice(-20))) : (r120?.price ?? Math.max(...prices120m.slice(-20)));
    const str120m = isBoom ? (s120?.strength ?? 1) : (r120?.strength ?? 1);
    const score120m = scoreSignal(currentPrice, ref120m, str120m, prices120m, isUp, rsi120m, market120m);
    if (score120m.score > 0.5) probability += 3;
    else probability -= 2;
  }
  probability = Math.min(Math.max(probability, 0), 97);

  const volScale = vol > 0 ? Math.max((vol / (currentPrice || 1)) / 0.0005, 0.5) : 1;

  // Ajustement SL/TP selon volatilité
  let slMultiplier = 0.6;
  let tpMultiplier = 1.8;
  if (regime.market === "volatile") {
    slMultiplier = 0.8;
    tpMultiplier = 2.2;
  } else if (regime.market === "calm") {
    slMultiplier = 0.4;
    tpMultiplier = 1.4;
  }

  const lookback = Math.min(history.length, 100);
  const recentHigh = Math.max(...history.slice(-lookback));
  const recentLow = Math.min(...history.slice(-lookback));
  const recentRange = currentPrice > 0 ? (recentHigh - recentLow) / currentPrice : 0.005;
  const magnitudePct = (0.008 + bestScore * 0.04) * (recentRange / 0.005) * volScale;
  const magnitudeStr = `${(magnitudePct * 100).toFixed(1)}%`;

  let levelTouched = false;
  if (touchModeEnabled) {
    const touchThreshold = 0.0008;
    const touchWindow = Math.min(history.length, 40);
    if (isBoom && nearestSupport) {
      for (let i = history.length - touchWindow; i < history.length; i++) {
        if (Math.abs(history[i] - nearestSupport.price) / nearestSupport.price < touchThreshold) {
          levelTouched = true; break;
        }
      }
    } else if (!isBoom && nearestResistance) {
      for (let i = history.length - touchWindow; i < history.length; i++) {
        if (Math.abs(history[i] - nearestResistance.price) / nearestResistance.price < touchThreshold) {
          levelTouched = true; break;
        }
      }
    }
  } else {
    levelTouched = true;
  }

    // Approche predictive : velocity + divergence
    let isApproaching = false;
    let approachVelocity = 0;
    const approachLevel = isBoom ? nearestSupport?.price : nearestResistance?.price;
    if (approachLevel) {
      const recent = history.slice(-10);
      let towardCount = 0;
      for (let i = 1; i < recent.length; i++) {
        const priceRise = recent[i] > recent[i - 1];
        const levelAbove = approachLevel > currentPrice;
        const movingToward = levelAbove ? priceRise : !priceRise;
        if (movingToward) towardCount++;
      }
      const slice = history.slice(-8);
      const slope = (slice[slice.length - 1] - slice[0]) / slice.length;
      const avgPrice2 = (currentPrice + approachLevel) / 2 || 1;
      const volScale2 = vol > 0 ? Math.max((vol / avgPrice2) / 0.0005, 0.5) : 1;
      approachVelocity = Math.abs(slope) / avgPrice2 / volScale2;
      const rsiRecent = rsi(history.slice(-30));
      const rsiDivergence = (isBoom && rsiRecent < 40) || (!isBoom && rsiRecent > 60);
      isApproaching = (towardCount >= 3 || approachVelocity > 0.3) || (towardCount >= 2 && rsiDivergence);
    }

  const pricePos = nearestSupport && nearestResistance
    ? Math.round(((currentPrice - nearestSupport.price) / (nearestResistance.price - nearestSupport.price)) * 100)
    : 50;

  const expDir = isBoom ? "up" : "down";
  const bestConsecutive = score.consecutive;

  let signal: Signal = "NEUTRAL";
  if (probability >= 85) signal = isBoom ? "STRONG_BUY" : "STRONG_SELL";
  else if (probability >= 80) signal = isBoom ? "BUY" : "SELL";

  const predictive = isApproaching && !levelTouched;
  let entryLevel: number;
  if (predictive) {
    entryLevel = isBoom
      ? currentPrice * 0.998
      : currentPrice * 1.002;
  } else {
    entryLevel = isBoom
      ? Math.min(nearestSupport?.price ?? currentPrice * 0.99, currentPrice * 0.998)
      : Math.max(nearestResistance?.price ?? currentPrice * 1.01, currentPrice * 1.002);
  }

  const slBuffer = vol * slMultiplier;
  const tpBuffer = vol * tpMultiplier;

  const stopLoss = isBoom
    ? (predictive ? entryLevel * 0.998 : Math.min(entryLevel * 0.996, entryLevel - slBuffer))
    : (predictive ? entryLevel * 1.002 : Math.max(entryLevel * 1.004, entryLevel + slBuffer));

  const tpTarget = predictive ? vol * 1.2 : vol * 0.8;
  const takeProfit = isBoom
    ? Math.max(entryLevel + tpTarget, currentPrice + tpTarget)
    : Math.min(entryLevel - tpTarget, currentPrice - tpTarget);

  let isConfirmed = false;
  let confirmationPrice: number | null = null;

  if (signal !== "NEUTRAL") {
    const prevSig = st.prevSignal;
    const isBuy = isBoom;
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

  const bestRef = orderBlocks.length > 0 && Math.abs(orderBlocks[0].price - currentPrice) / currentPrice < 0.01
    ? { level: orderBlocks[0].price, strength: orderBlocks[0].strength }
    : { level: score.referenceLevel, strength: score.referenceStrength };

  return {
    type, number: num, currentPrice,
    spikeProbability: Math.round(Math.min(probability, 97)),
    expectedDirection: expDir,
    estimatedMagnitude: magnitudeStr,
    timeSinceLastSpike: Math.round(msSinceLastSpike / 1000),
    isSpikeImminent: probability >= (volScale > 1.5 ? 72 : 75) && (levelTouched || isApproaching),
    levelTouched,
    isApproaching,
    approachVelocity: Math.round(approachVelocity * 100) / 100,
    volScale: Math.round(volScale * 100) / 100,
    pricePosition: pricePos,
    consecutiveMoves: bestConsecutive,
    rangeLow: nearestSupport?.price ?? currentPrice * 0.98,
    rangeHigh: nearestResistance?.price ?? currentPrice * 1.02,
    referenceLevel: Math.round(bestRef.level * 100) / 100,
    referenceStrength: bestRef.strength,
    distancePercent: Math.round(Math.abs(currentPrice - bestRef.level) / (bestRef.level || currentPrice) * 10000) / 100,
    sRlevels: allLevels.slice(0, 6).map(l => ({ price: Math.round(l.price * 100) / 100, strength: l.strength, type: l.type })),
    orderBlocks: orderBlocks.slice(0, 4).map(ob => ({ price: Math.round(ob.price * 100) / 100, type: ob.type, strength: ob.strength })),
    upScore: Math.round(score.score * 100),
    downScore: Math.round((1 - score.score) * 100),
    connected: st.connected,
    timestamp: Date.now(),
    signal,
    entryPrice: Math.round(entryLevel * 100) / 100,
    stopLoss: Math.round(stopLoss * 100) / 100,
    takeProfit: Math.round(takeProfit * 100) / 100,
    isConfirmed,
    confirmationPrice: confirmationPrice ? Math.round(confirmationPrice * 100) / 100 : null,
    // Nouveaux champs pour analyse
    indicators: {
      macd: macdResult ? { histogram: Math.round(macdResult.histogram * 10000) / 10000, signal: Math.round(macdResult.signal * 100) / 100, macd: Math.round(macdResult.macd * 100) / 100 } : null,
      bollinger: bbResult ? { bandwidth: Math.round(bbResult.bandwidth * 10000) / 10000, upper: Math.round(bbResult.upper * 100) / 100, lower: Math.round(bbResult.lower * 100) / 100 } : null,
      ichimoku: ichimokuResult ? { tenkan: Math.round(ichimokuResult.tenkan * 100) / 100, kijun: Math.round(ichimokuResult.kijun * 100) / 100, senkouA: Math.round(ichimokuResult.senkouA * 100) / 100, senkouB: Math.round(ichimokuResult.senkouB * 100) / 100 } : null,
      stochRsi: Math.round(stochRsi * 100) / 100,
      adx: Math.round(adx * 10) / 10,
      trendStrength: Math.round(trendStrength * 10) / 10,
      vwapDistance: Math.round(vwapDistance * 10000) / 10000,
    },
    regime: {
      volatility: regime.volatility,
      market: regime.market,
      adx: regime.adx,
      recommendation: regime.recommendation,
    },
    candlePatterns: candlePatterns.slice(0, 3).map(p => ({ name: p.name, signal: p.signal, strength: p.strength })),
  };
}

// Fonctions helper internes (sans import pour éviter les dépendances circulaires)
function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } | null {
  if (prices.length < 35) return null;
  const fastPeriod = 12, slowPeriod = 26, signalPeriod = 9;
  const multiplierFast = 2 / (fastPeriod + 1);
  const multiplierSlow = 2 / (slowPeriod + 1);
  const fastEMA: number[] = [];
  const slowEMA: number[] = [];
  const sumFast = prices.slice(0, fastPeriod).reduce((a, b) => a + b, 0);
  const sumSlow = prices.slice(0, slowPeriod).reduce((a, b) => a + b, 0);
  fastEMA.push(sumFast / fastPeriod);
  slowEMA.push(sumSlow / slowPeriod);
  for (let i = fastPeriod; i < prices.length; i++) fastEMA.push((prices[i] - fastEMA[fastEMA.length - 1]) * multiplierFast + fastEMA[fastEMA.length - 1]);
  for (let i = slowPeriod; i < prices.length; i++) slowEMA.push((prices[i] - slowEMA[slowEMA.length - 1]) * multiplierSlow + slowEMA[slowEMA.length - 1]);
  const offset = fastEMA.length - slowEMA.length;
  const macdLine: number[] = [];
  for (let i = 0; i < slowEMA.length; i++) macdLine.push(fastEMA[offset + i] - slowEMA[i]);
  const multiplierSignal = 2 / (signalPeriod + 1);
  const signalLine: number[] = [macdLine.slice(0, signalPeriod).reduce((a, b) => a + b, 0) / signalPeriod];
  for (let i = signalPeriod; i < macdLine.length; i++) signalLine.push((macdLine[i] - signalLine[signalLine.length - 1]) * multiplierSignal + signalLine[signalLine.length - 1]);
  const lastMacd = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  return { macd: lastMacd, signal: lastSignal, histogram: lastMacd - lastSignal };
}

function calculateBollingerBands(prices: number[]): { upper: number; middle: number; lower: number; bandwidth: number } | null {
  const period = 20;
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, p) => sum + (p - middle) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);
  return { upper: middle + stdDev * 2, middle, lower: middle - stdDev * 2, bandwidth: (stdDev * 4) / middle };
}

function calculateIchimoku(prices: number[]): { tenkan: number; kijun: number; senkouA: number; senkouB: number } | null {
  if (prices.length < 52) return null;
  const tenkan = (Math.max(...prices.slice(-9)) + Math.min(...prices.slice(-9))) / 2;
  const kijun = (Math.max(...prices.slice(-26)) + Math.min(...prices.slice(-26))) / 2;
  const senkouA = (tenkan + kijun) / 2;
  const senkouB = (Math.max(...prices.slice(-52)) + Math.min(...prices.slice(-52))) / 2;
  return { tenkan, kijun, senkouA, senkouB };
}

function calculateStochasticRSI(prices: number[]): number {
  const rsiValues: number[] = [];
  for (let i = 14; i < prices.length; i++) {
    const slice = prices.slice(i - 14, i + 1);
    if (slice.length < 15) continue;
    let gains = 0, losses = 0;
    for (let j = 1; j < slice.length; j++) {
      const diff = slice[j] - slice[j - 1];
      if (diff > 0) gains += diff; else losses -= diff;
    }
    if (losses === 0) rsiValues.push(100);
    else rsiValues.push(100 - 100 / (1 + gains / losses));
  }
  if (rsiValues.length < 14) return 50;
  const recent = rsiValues.slice(-14);
  const minR = Math.min(...recent);
  const maxR = Math.max(...recent);
  return maxR === minR ? 50 : ((rsiValues[rsiValues.length - 1] - minR) / (maxR - minR)) * 100;
}

function calculateADXInternal(prices: number[]): number {
  if (prices.length < 28) return 25;
  const upMoves: number[] = [];
  const downMoves: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    upMoves.push(diff > 0 ? diff : 0);
    downMoves.push(diff < 0 ? -diff : 0);
  }
  const period = 14;
  const smoothUp: number[] = [upMoves.slice(0, period).reduce((a, b) => a + b, 0) / period];
  const smoothDown: number[] = [downMoves.slice(0, period).reduce((a, b) => a + b, 0) / period];
  for (let i = period; i < upMoves.length; i++) {
    smoothUp.push((smoothUp[smoothUp.length - 1] * (period - 1) + upMoves[i]) / period);
    smoothDown.push((smoothDown[smoothDown.length - 1] * (period - 1) + downMoves[i]) / period);
  }
  const diPlus: number[] = [];
  const diMinus: number[] = [];
  for (let i = 0; i < smoothUp.length; i++) {
    const sum = smoothUp[i] + smoothDown[i];
    diPlus.push(sum > 0 ? (smoothUp[i] / sum) * 100 : 0);
    diMinus.push(sum > 0 ? (smoothDown[i] / sum) * 100 : 0);
  }
  const dx: number[] = [];
  for (let i = 0; i < diPlus.length; i++) {
    const diff = Math.abs(diPlus[i] - diMinus[i]);
    const sum = diPlus[i] + diMinus[i];
    dx.push(sum > 0 ? (diff / sum) * 100 : 0);
  }
  if (dx.length < period) return 25;
  const adxSlice = dx.slice(-period);
  return adxSlice.reduce((a, b) => a + b, 0) / period;
}

function detectTrendStrengthInternal(prices: number[]): number {
  if (prices.length < 40) return 0;
  const short = prices.slice(-10);
  const long = prices.slice(-40);
  const shortSlope = (short[short.length - 1] - short[0]) / short.length;
  const longSlope = (long[long.length - 1] - long[0]) / long.length;
  const basePrice = long.reduce((a, b) => a + b, 0) / long.length || 1;
  if (shortSlope > 0 && longSlope > 0) return ((shortSlope / basePrice) * 100 + (longSlope / basePrice) * 25) * 10;
  if (shortSlope < 0 && longSlope < 0) return -((Math.abs(shortSlope / basePrice) * 100 + Math.abs(longSlope / basePrice) * 25) * 10);
  return 0;
}

function analyzeRegimeInternal(prices: number[]): { volatility: string; market: string; adx: number; recommendation: string } {
  if (prices.length < 50) return { volatility: "medium", market: "ranging", adx: 25, recommendation: "Données insuffisantes" };
  const atr14 = atr(prices, 14);
  const atr50 = atr(prices, 50);
  const volatility = atr50 > 0 ? (atr14 / atr50 > 1.5 ? "high" : atr14 / atr50 < 0.7 ? "low" : "medium") : "medium";
  const adxVal = calculateADXInternal(prices);
  const trendStrength = detectTrendStrengthInternal(prices);
  let market: string;
  let recommendation: string;

  if (adxVal > 25 && trendStrength > 15) {
    market = "trending_bull";
    recommendation = "Tendance haussière détectée";
  } else if (adxVal > 25 && trendStrength < -15) {
    market = "trending_bear";
    recommendation = "Tendance baissière détectée";
  } else if (volatility === "high") {
    market = "volatile";
    recommendation = "Volatilité élevée, stops larges recommandés";
  } else if (adxVal < 20) {
    market = "calm";
    recommendation = "Marché calme, attendre confirmation";
  } else {
    market = "ranging";
    recommendation = "Marché range, scalping recommandé";
  }

  return { volatility, market, adx: Math.round(adxVal * 10) / 10, recommendation };
}

function calculateVWAP(prices: number[]): number {
  if (prices.length === 0) return 0;
  const total = prices.reduce((sum, p, i) => sum + p * (i + 1), 0);
  const vol = (prices.length * (prices.length + 1)) / 2;
  return total / vol;
}

function detectCandlestickPatterns(candles: { open: number; high: number; low: number; close: number }[]): { name: string; signal: string; strength: number }[] {
  if (candles.length < 3) return [];
  const patterns: { name: string; signal: string; strength: number }[] = [];
  const curr = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  const body = Math.abs(curr.close - curr.open);
  const range = curr.high - curr.low;
  const isDoji = range > 0 && body / range < 0.001;
  if (isDoji) patterns.push({ name: "Doji", signal: "neutral", strength: 1 });

  const lowerWick = Math.min(curr.open, curr.close) - curr.low;
  const upperWick = curr.high - Math.max(curr.open, curr.close);
  const isHammer = range > 0 && body < range * 0.3 && lowerWick > body * 2 && upperWick < body * 0.5;
  if (isHammer) patterns.push({ name: "Hammer", signal: "bullish", strength: 3 });

  const isShootingStar = range > 0 && body < range * 0.3 && upperWick > body * 2 && lowerWick < body * 0.5;
  if (isShootingStar) patterns.push({ name: "Shooting Star", signal: "bearish", strength: 3 });

  const isBullEngulf = prev.close < prev.open && curr.close > curr.open && curr.open < prev.close && curr.close > prev.open;
  if (isBullEngulf) patterns.push({ name: "Bullish Engulfing", signal: "bullish", strength: 3 });

  const isBearEngulf = prev.close > prev.open && curr.close < curr.open && curr.open > prev.close && curr.close < prev.open;
  if (isBearEngulf) patterns.push({ name: "Bearish Engulfing", signal: "bearish", strength: 3 });

  return patterns;
}

function getPatternSignal(patterns: { name: string; signal: string; strength: number }[]): { signal: string; score: number } {
  let score = 0;
  for (const p of patterns) {
    if (p.signal === "bullish") score += p.strength;
    else if (p.signal === "bearish") score -= p.strength;
  }
  return { signal: score > 2 ? "bullish" : score < -2 ? "bearish" : "neutral", score };
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
  indicators?: any;
  regime?: any;
  candlePatterns?: any[];
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
      regime: prediction.regime,
      candlePatterns: prediction.candlePatterns,
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
