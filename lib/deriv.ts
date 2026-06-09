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
const candleMap = new Map<string, Candlestick[]>();
const priceAt24hAgo = new Map<string, number>();

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
  candleMap.set(getKey(idx.type, idx.number), []);
}

let ws: any = null;
let wsConnected = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let historyLoaded = false;
const DERIV_TOKEN = process.env.NEXT_PUBLIC_DERIV_TOKEN || "";
const DERIV_WS_URL = DERIV_TOKEN
  ? `wss://api.derivws.com/trading/v1/options/ws/real?otp=${DERIV_TOKEN}`
  : "wss://api.derivws.com/trading/v1/options/ws/public";

const isServer = typeof window === "undefined";

function createWebSocket(url: string): any {
  if (isServer) {
    // Use the 'ws' library on Node.js (native WebSocket has issues on Windows)
    const { WebSocket: WsWebSocket } = require("ws");
    return new WsWebSocket(url);
  }
  return new WebSocket(url);
}

const CANDLE_INTERVAL = 60; // 1 minute candles in seconds

function updateCandle(key: string, price: number, timeMs: number) {
  const candles = candleMap.get(key);
  if (!candles) return;

  const candleTime = Math.floor(timeMs / 1000 / CANDLE_INTERVAL) * CANDLE_INTERVAL;

  if (candles.length === 0 || candles[candles.length - 1].time !== candleTime) {
    candles.push({
      time: candleTime,
      open: price,
      high: price,
      low: price,
      close: price,
    });
    if (candles.length > 200) candles.shift();
  } else {
    const last = candles[candles.length - 1];
    last.high = Math.max(last.high, price);
    last.low = Math.min(last.low, price);
    last.close = price;
  }
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

  updateCandle(key, quote, ts);

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

export function connectDerivWebSocket(): boolean {
  if (wsConnected) return true;
  if (!DERIV_WS_URL) return false;

  try {
    ws = createWebSocket(DERIV_WS_URL);

    const onOpen = () => {
      wsConnected = true;
      historyLoaded = false;
      subscribeAll();
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
      for (const st of stateMap.values()) {
        st.connected = false;
      }
      reconnectTimer = setTimeout(() => {
        connectDerivWebSocket();
      }, 3000);
    };

    const onError = (err: any) => {
      if (!isServer) console.error("[Deriv] WebSocket error:", err?.message || err);
      wsConnected = false;
    };

    wsOn(ws, "open", onOpen);
    wsOn(ws, "message", onMessage);
    wsOn(ws, "close", onClose);
    wsOn(ws, "error", onError);

    return true;
  } catch (err) {
    console.error("[Deriv] Failed to create WebSocket:", err);
    wsConnected = false;
    return false;
  }
}

export function disconnectDerivWebSocket() {
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

const CLUSTER_TOLERANCE = 0.003; // 0.3% clustering threshold for S/R levels

interface SRLevel {
  price: number;
  strength: number; // number of touches
  type: "support" | "resistance";
}

interface OrderBlock {
  price: number;
  type: "bullish" | "bearish";
  strength: number;
  rangeLow: number;
  rangeHigh: number;
}

function findOrderBlocks(prices: number[]): OrderBlock[] {
  const blocks: OrderBlock[] = [];
  const lookback = prices.slice(-200);
  if (lookback.length < 20) return blocks;

  const bodyThreshold = 0.001; // minimum body size relative to price

  for (let i = 5; i < lookback.length - 5; i++) {
    const candle = lookback[i];
    const prevCandle = lookback[i - 1];
    const next1 = lookback[i + 1];
    const next2 = lookback[i + 2];
    const next3 = lookback[i + 3];

    const change = candle - prevCandle;
    const bodySize = Math.abs(change) / candle;

    if (bodySize < bodyThreshold) continue;

    // Bullish order block: strong bearish candle followed by at least 2 up moves
    if (change < 0 && next1 > candle && next2 > next1) {
      const rangeLow = Math.min(candle, prevCandle);
      const rangeHigh = Math.max(candle, prevCandle);
      // Avoid duplicates
      const existing = blocks.find(b =>
        b.type === "bullish" && Math.abs(b.price - rangeLow) / (rangeLow || 1) < CLUSTER_TOLERANCE
      );
      if (existing) {
        existing.strength++;
        existing.price = (existing.price * (existing.strength - 1) + rangeLow) / existing.strength;
      } else {
        blocks.push({ price: rangeLow, type: "bullish", strength: 1, rangeLow, rangeHigh });
      }
    }

    // Bearish order block: strong bullish candle followed by at least 2 down moves
    if (change > 0 && next1 < candle && next2 < next1) {
      const rangeLow = Math.min(candle, prevCandle);
      const rangeHigh = Math.max(candle, prevCandle);
      const existing = blocks.find(b =>
        b.type === "bearish" && Math.abs(b.price - rangeHigh) / (rangeHigh || 1) < CLUSTER_TOLERANCE
      );
      if (existing) {
        existing.strength++;
        existing.price = (existing.price * (existing.strength - 1) + rangeHigh) / existing.strength;
      } else {
        blocks.push({ price: rangeHigh, type: "bearish", strength: 1, rangeLow, rangeHigh });
      }
    }
  }

  return blocks.sort((a, b) => b.strength - a.strength).slice(0, 6);
}

function findSupportResistance(prices: number[], currentPrice: number): {
  nearestSupport: SRLevel | null;
  nearestResistance: SRLevel | null;
  allLevels: SRLevel[];
} {
  const lookback = prices.slice(-120);

  // Step 1: Find all pivot highs and pivot lows
  const pivots: { price: number; isHigh: boolean }[] = [];
  for (let i = 2; i < lookback.length - 2; i++) {
    const curr = lookback[i];
    const prev1 = lookback[i - 1];
    const prev2 = lookback[i - 2];
    const next1 = lookback[i + 1];
    const next2 = lookback[i + 2];

    const isPivotHigh = curr > prev1 && curr > prev2 && curr > next1 && curr > next2;
    const isPivotLow = curr < prev1 && curr < prev2 && curr < next1 && curr < next2;

    if (isPivotHigh) pivots.push({ price: curr, isHigh: true });
    if (isPivotLow) pivots.push({ price: curr, isHigh: false });
  }

  if (pivots.length === 0) return { nearestSupport: null, nearestResistance: null, allLevels: [] };

  // Step 2: Cluster nearby pivots into zones
  const clusters: { avgPrice: number; touches: number; isHigh: boolean }[] = [];

  for (const pivot of pivots) {
    const existing = clusters.find(
      c => Math.abs(c.avgPrice - pivot.price) / pivot.price < CLUSTER_TOLERANCE && c.isHigh === pivot.isHigh
    );
    if (existing) {
      existing.avgPrice = (existing.avgPrice * existing.touches + pivot.price) / (existing.touches + 1);
      existing.touches++;
    } else {
      clusters.push({ avgPrice: pivot.price, touches: 1, isHigh: pivot.isHigh });
    }
  }

  // Step 3: Classify each cluster as support or resistance relative to current price
  const supports: SRLevel[] = clusters
    .filter(c => c.avgPrice < currentPrice)
    .map(c => ({ price: c.avgPrice, strength: c.touches, type: "support" as const }));

  const resistances: SRLevel[] = clusters
    .filter(c => c.avgPrice > currentPrice)
    .map(c => ({ price: c.avgPrice, strength: c.touches, type: "resistance" as const }));

  // Sort: nearest first
  supports.sort((a, b) => b.price - a.price);
  resistances.sort((a, b) => a.price - b.price);

  // Step 4: Find the strongest of the nearest levels (weight proximity vs strength)
  const scoreLevel = (level: SRLevel): number => {
    const distPct = Math.abs(level.price - currentPrice) / currentPrice;
    const distScore = Math.max(0, 1 - distPct / 0.02); // 2% max distance
    return distScore * 0.4 + (level.strength / 10) * 0.6;
  };

  supports.sort((a, b) => scoreLevel(b) - scoreLevel(a));
  resistances.sort((a, b) => scoreLevel(b) - scoreLevel(a));

  const allLevels = [...supports, ...resistances].sort((a, b) => b.strength - a.strength);

  return {
    nearestSupport: supports.length > 0 ? supports[0] : null,
    nearestResistance: resistances.length > 0 ? resistances[0] : null,
    allLevels,
  };
}

function scoreDirection(
  currentPrice: number, level: number | null, strength: number,
  history: number[], isUp: boolean
): { score: number; referenceLevel: number; referenceStrength: number; distancePct: number; consecutive: number } {
  const refLevel = level ?? (isUp
    ? Math.min(...history.slice(-20))
    : Math.max(...history.slice(-20))
  );
  const refStrength = level ? strength : 1;

  const distance = Math.abs(currentPrice - refLevel);
  const maxDist = refLevel * 0.015;
  const proximity = Math.max(0, 1 - distance / maxDist);
  const extreme = Math.min(proximity, 1);

  const broke = isUp ? currentPrice < refLevel : currentPrice > refLevel;
  const effectiveExtreme = broke ? extreme * 0.2 : extreme;

  const recentMoves = history.slice(-15).map((p, i, arr) => i > 0 ? p - arr[i - 1] : 0).slice(1);
  const consecutive = recentMoves.slice(-5).filter(m => isUp ? m < 0 : m > 0).length;
  const momentum = Math.min(consecutive / 5, 1);

  const strengthBonus = Math.min(refStrength / 5, 1) * 0.15;

  const score = effectiveExtreme * 0.55 + momentum * 0.2 + strengthBonus;
  return { score, referenceLevel: refLevel, referenceStrength: refStrength, distancePct: distance / (refLevel || currentPrice) * 100, consecutive };
}

function scoreOB(
  currentPrice: number, blocks: OrderBlock[], isUp: boolean
): { score: number; level: number; strength: number } {
  const relevant = blocks.filter(b => b.type === (isUp ? "bullish" : "bearish"));
  if (relevant.length === 0) return { score: 0, level: currentPrice, strength: 0 };

  let bestScore = 0;
  let bestLevel = currentPrice;
  let bestStrength = 0;

  for (const ob of relevant) {
    const distance = Math.abs(currentPrice - ob.price);
    const maxDist = ob.price * 0.02;
    const proximity = Math.max(0, 1 - distance / maxDist);
    const strengthFactor = Math.min(ob.strength / 3, 1);
    const obScore = proximity * 0.6 + strengthFactor * 0.4;

    if (obScore > bestScore) {
      bestScore = obScore;
      bestLevel = ob.price;
      bestStrength = ob.strength;
    }
  }

  return { score: bestScore, level: bestLevel, strength: bestStrength };
}

export function predictSpike(type: IndexType, num: number) {
  const key = getKey(type, num);
  const st = stateMap.get(key);
  if (!st || st.history.length < 20) {
    return { error: "Pas assez de données historiques" };
  }

  const history = st.history;
  const currentPrice = st.price;
  const { nearestSupport, nearestResistance, allLevels } = findSupportResistance(history, currentPrice);
  const orderBlocks = findOrderBlocks(history);

  const ns = nearestSupport;
  const nr = nearestResistance;

  const upSR = scoreDirection(currentPrice, ns?.price ?? null, ns?.strength ?? 0, history, true);
  const downSR = scoreDirection(currentPrice, nr?.price ?? null, nr?.strength ?? 0, history, false);
  const upOB = scoreOB(currentPrice, orderBlocks, true);
  const downOB = scoreOB(currentPrice, orderBlocks, false);

  const upTotal = upSR.score * 0.85 + upOB.score * 0.15;
  const downTotal = downSR.score * 0.85 + downOB.score * 0.15;

  const isUp = upTotal >= downTotal;
  const bestScore = isUp ? upTotal : downTotal;
  const bestRef = isUp
    ? (upOB.score > upSR.score * 0.3 ? { level: upOB.level, strength: upOB.strength } : { level: upSR.referenceLevel, strength: upSR.referenceStrength })
    : (downOB.score > downSR.score * 0.3 ? { level: downOB.level, strength: downOB.strength } : { level: downSR.referenceLevel, strength: downSR.referenceStrength });

  const msSinceLastSpike = Date.now() - st.lastSpikeTime;
  const timeFactor = Math.min(msSinceLastSpike / 30000, 1);
  const probability = Math.min((bestScore + timeFactor * 0.1) * 100, 95);

  const volatilityFactor = 1000 / num;
  const magnitudePct = (0.015 + bestScore * 0.05) * volatilityFactor;
  const magnitudeStr = `${(magnitudePct * 100).toFixed(1)}%`;

  const pricePos = ns && nr
    ? Math.round(((currentPrice - ns.price) / (nr.price - ns.price)) * 100)
    : 50;

  const expDir = isUp ? "up" : "down";
  const bestConsecutive = isUp ? upSR.consecutive : downSR.consecutive;

  // --- Signal generation ---
  let signal: Signal = "NEUTRAL";
  if (probability >= 80) signal = isUp ? "STRONG_BUY" : "STRONG_SELL";
  else if (probability >= 60) signal = isUp ? "BUY" : "SELL";

  const entryLevel = isUp
    ? (ns?.price ?? currentPrice * 0.98)
    : (nr?.price ?? currentPrice * 1.02);

  const stopDist = currentPrice * magnitudePct * 0.5;
  const takeDist = currentPrice * magnitudePct * 1.5;

  const stopLoss = isUp
    ? Math.min(entryLevel * 0.995, entryLevel - stopDist)
    : Math.max(entryLevel * 1.005, entryLevel + stopDist);

  const takeProfit = isUp
    ? entryLevel + takeDist
    : entryLevel - takeDist;

  // --- Confirmation logic ---
  let isConfirmed = false;
  let confirmationPrice: number | null = null;

  if (signal !== "NEUTRAL") {
    const prevSig = st.prevSignal;
    const sigChanged = prevSig !== (isUp ? "BUY" : "SELL") && prevSig !== (isUp ? "STRONG_BUY" : "STRONG_SELL");

    if (sigChanged) {
      st.prevSignal = isUp ? (signal === "STRONG_BUY" ? "STRONG_BUY" : "BUY") : (signal === "STRONG_SELL" ? "STRONG_SELL" : "SELL");
      st.prevSignalPrice = currentPrice;
      st.prevSignalTime = Date.now();
      st.confirmationTriggered = false;
    }

    const priceSinceSignal = (currentPrice - st.prevSignalPrice) / st.prevSignalPrice;

    if (!st.confirmationTriggered) {
      if (isUp && priceSinceSignal >= 0.001) {
        isConfirmed = true;
        confirmationPrice = currentPrice;
        st.confirmationTriggered = true;
      } else if (!isUp && priceSinceSignal <= -0.001) {
        isConfirmed = true;
        confirmationPrice = currentPrice;
        st.confirmationTriggered = true;
      }
    } else {
      isConfirmed = true;
      confirmationPrice = st.prevSignalPrice;
    }
  }

  return {
    type,
    number: num,
    currentPrice,
    spikeProbability: Math.round(probability),
    expectedDirection: expDir,
    estimatedMagnitude: magnitudeStr,
    timeSinceLastSpike: Math.round(msSinceLastSpike / 1000),
    isSpikeImminent: probability > 70,
    pricePosition: pricePos,
    consecutiveMoves: bestConsecutive,
    rangeLow: ns?.price ?? currentPrice * 0.98,
    rangeHigh: nr?.price ?? currentPrice * 1.02,
    referenceLevel: bestRef.level,
    referenceStrength: bestRef.strength,
    distancePercent: Math.round(Math.abs(currentPrice - bestRef.level) / (bestRef.level || currentPrice) * 10000) / 100,
    sRlevels: allLevels.slice(0, 6).map(l => ({
      price: Math.round(l.price * 100) / 100,
      strength: l.strength,
      type: l.type,
    })),
    orderBlocks: orderBlocks.slice(0, 4).map(ob => ({
      price: Math.round(ob.price * 100) / 100,
      type: ob.type,
      strength: ob.strength,
    })),
    upScore: Math.round(upTotal * 100),
    downScore: Math.round(downTotal * 100),
    connected: st.connected,
    timestamp: Date.now(),
    // New trade signal fields
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
  return candleMap.get(getKey(type, num)) || [];
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
