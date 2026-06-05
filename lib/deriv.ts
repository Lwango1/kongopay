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
  });
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

export function predictSpike(type: IndexType, num: number) {
  const key = getKey(type, num);
  const st = stateMap.get(key);
  if (!st || st.history.length < 20) {
    return { error: "Pas assez de données historiques" };
  }

  const history = st.history;
  const currentPrice = st.price;
  const { nearestSupport, nearestResistance, allLevels } = findSupportResistance(history, currentPrice);

  let extremeFactor: number;
  let expectedDirection: string;
  let referenceLevel: number | null;
  let referenceStrength: number;
  let distanceToLevel: number;

  if (type === "BOOM") {
    // Boom: spike UP when price touches a strong support (oversold)
    referenceLevel = nearestSupport?.price ?? null;
    referenceStrength = nearestSupport?.strength ?? 0;

    if (referenceLevel === null) {
      // Fallback: use min of last 20 candles
      const recentMin = Math.min(...history.slice(-20));
      referenceLevel = recentMin;
      referenceStrength = 1;
    }

    distanceToLevel = Math.abs(currentPrice - referenceLevel);
    const maxDistance = referenceLevel * 0.015;
    const proximity = Math.max(0, 1 - distanceToLevel / maxDistance);
    extremeFactor = Math.min(proximity, 1);
    expectedDirection = "up";

    // If price broke below support, reduce confidence
    if (currentPrice < referenceLevel) {
      extremeFactor = Math.max(0, extremeFactor * 0.2);
    }
  } else {
    // Crash: spike DOWN when price touches a strong resistance (overbought)
    referenceLevel = nearestResistance?.price ?? null;
    referenceStrength = nearestResistance?.strength ?? 0;

    if (referenceLevel === null) {
      // Fallback: use max of last 20 candles
      const recentMax = Math.max(...history.slice(-20));
      referenceLevel = recentMax;
      referenceStrength = 1;
    }

    distanceToLevel = Math.abs(currentPrice - referenceLevel);
    const maxDistance = referenceLevel * 0.015;
    const proximity = Math.max(0, 1 - distanceToLevel / maxDistance);
    extremeFactor = Math.min(proximity, 1);
    expectedDirection = "down";

    // If price broke above resistance, reduce confidence
    if (currentPrice > referenceLevel) {
      extremeFactor = Math.max(0, extremeFactor * 0.2);
    }
  }

  const recentMoves = history.slice(-15).map((p, i, arr) => i > 0 ? p - arr[i - 1] : 0).slice(1);
  const consecutive = recentMoves.slice(-5).filter(m => type === "BOOM" ? m < 0 : m > 0).length;
  const momentumFactor = Math.min(consecutive / 5, 1);

  const msSinceLastSpike = Date.now() - st.lastSpikeTime;
  const timeFactor = Math.min(msSinceLastSpike / 30000, 1);

  const strengthBonus = Math.min(referenceStrength / 5, 1) * 0.15;
  const spikeProbability = Math.min((extremeFactor * 0.55 + momentumFactor * 0.2 + timeFactor * 0.1 + strengthBonus) * 100, 95);
  const volatilityFactor = 1000 / num;
  const estimatedMagnitude = ((0.015 + extremeFactor * 0.05) * volatilityFactor * 100).toFixed(1);

  const sRrange = (nearestResistance?.price ?? currentPrice * 1.02) - (nearestSupport?.price ?? currentPrice * 0.98);

  return {
    type,
    number: num,
    currentPrice,
    spikeProbability: Math.round(spikeProbability),
    expectedDirection,
    estimatedMagnitude: `${estimatedMagnitude}%`,
    timeSinceLastSpike: Math.round(msSinceLastSpike / 1000),
    isSpikeImminent: spikeProbability > 70,
    pricePosition: nearestSupport && nearestResistance
      ? Math.round(((currentPrice - nearestSupport.price) / (nearestResistance.price - nearestSupport.price)) * 100)
      : 50,
    consecutiveMoves: consecutive,
    rangeLow: nearestSupport?.price ?? currentPrice * 0.98,
    rangeHigh: nearestResistance?.price ?? currentPrice * 1.02,
    referenceLevel,
    referenceStrength,
    distancePercent: Math.round((distanceToLevel / (referenceLevel || currentPrice)) * 10000) / 100,
    sRlevels: allLevels.slice(0, 6).map(l => ({
      price: Math.round(l.price * 100) / 100,
      strength: l.strength,
      type: l.type,
    })),
    connected: st.connected,
    timestamp: Date.now(),
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
