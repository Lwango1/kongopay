// Synthetic indices: Boom (upward spikes) & Crash (downward drops)
// Higher number = less volatile
// 500 = high volatility, 900 = medium, 1000 = low

type IndexType = "BOOM" | "CRASH";

interface IndexConfig {
  type: IndexType;
  number: number;
  basePrice: number;
}

interface IndexState {
  price: number;
  change24h: number;
  history: number[];
  lastSpikeTime: number;
  lastSpikeDirection: "up" | "down" | null;
}

const INDICES: IndexConfig[] = [
  { type: "BOOM", number: 500, basePrice: 25000 },
  { type: "BOOM", number: 900, basePrice: 18000 },
  { type: "BOOM", number: 1000, basePrice: 15000 },
  { type: "CRASH", number: 500, basePrice: 25000 },
  { type: "CRASH", number: 900, basePrice: 18000 },
  { type: "CRASH", number: 1000, basePrice: 15000 },
];

function getKey(type: IndexType, num: number) { return `${type}_${num}`; }

const stateMap = new Map<string, IndexState>();

for (const idx of INDICES) {
  stateMap.set(getKey(idx.type, idx.number), {
    price: idx.basePrice,
    change24h: 0,
    history: [idx.basePrice],
    lastSpikeTime: Date.now(),
    lastSpikeDirection: null,
  });
}

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const spikeLog: Record<string, number[]> = {};

function generateTick(type: IndexType, num: number, currentPrice: number, timestamp: number) {
  const seed = timestamp / 1000;
  const rand = seededRandom(seed);
  const spikeRand = seededRandom(seed + num + 777);
  const key = getKey(type, num);

  const volatilityFactor = 1000 / num;
  let change: number;
  let isSpike = false;

  if (type === "BOOM") {
    if (spikeRand > 0.97) {
      change = currentPrice * (0.02 + rand * 0.06) * volatilityFactor;
      isSpike = true;
    } else {
      change = currentPrice * (rand * 0.002 - 0.0005) * (volatilityFactor * 0.5);
    }
  } else {
    if (spikeRand > 0.97) {
      change = -currentPrice * (0.02 + rand * 0.06) * volatilityFactor;
      isSpike = true;
    } else {
      change = currentPrice * (rand * 0.002 - 0.0015) * (volatilityFactor * 0.5);
    }
  }

  if (isSpike) {
    if (!spikeLog[key]) spikeLog[key] = [];
    spikeLog[key].push(timestamp);
    if (spikeLog[key].length > 20) spikeLog[key].shift();
  }

  const newPrice = Math.max(currentPrice + change, currentPrice * 0.3);
  return Math.round(newPrice * 100) / 100;
}

export function getDerivState() {
  const now = Date.now();

  for (const idx of INDICES) {
    const key = getKey(idx.type, idx.number);
    const st = stateMap.get(key)!;

    for (let i = 0; i < 5; i++) {
      const t = now - (5 - i) * 200;
      const prevPrice = st.price;
      st.price = generateTick(idx.type, idx.number, st.price, t);

      const spikeSize = Math.abs(st.price - prevPrice) / prevPrice;
      if (spikeSize > 0.015) {
        st.lastSpikeTime = t;
        st.lastSpikeDirection = st.price > prevPrice ? "up" : "down";
      }
    }

    st.history.push(st.price);
    if (st.history.length > 200) st.history.shift();
    st.change24h = st.history.length > 1 ? ((st.price - st.history[0]) / st.history[0]) * 100 : 0;
  }

  const result: Record<string, any> = { timestamp: now };

  for (const idx of INDICES) {
    const key = getKey(idx.type, idx.number);
    const st = stateMap.get(key)!;
    const label = `${idx.type.toLowerCase()}_${idx.number}`;
    result[label] = {
      price: st.price,
      change24h: st.change24h,
      history: st.history.slice(-100),
      type: idx.type,
      number: idx.number,
      lastSpikeTime: st.lastSpikeTime,
      lastSpikeDirection: st.lastSpikeDirection,
    };
  }

  return result;
}

export function predictNextTick(type: IndexType, num: number) {
  const key = getKey(type, num);
  const st = stateMap.get(key);

  if (!st) return { error: "Index not found" };

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
    timestamp: Date.now(),
  };
}

export function predictSpike(type: IndexType, num: number) {
  const key = getKey(type, num);
  const st = stateMap.get(key);
  if (!st) return { error: "Index not found" };

  const history = st.history;
  const lookback = history.slice(-50);
  const minPrice = Math.min(...lookback);
  const maxPrice = Math.max(...lookback);
  const range = maxPrice - minPrice || 1;

  // Position of current price within recent range (0 = low, 1 = high)
  const position = (st.price - minPrice) / range;

  // Boom: spike UP when price is near a LOW (position close to 0)
  // Crash: spike DOWN when price is near a HIGH (position close to 1)
  let extremeFactor: number;
  let expectedDirection: string;

  if (type === "BOOM") {
    // Closer to low = more likely to spike UP
    extremeFactor = 1 - position;
    expectedDirection = "up";
  } else {
    // Closer to high = more likely to spike DOWN
    extremeFactor = position;
    expectedDirection = "down";
  }

  // Consecutive moves in the opposite direction increase probability
  const recentMoves = history.slice(-15).map((p, i, arr) => i > 0 ? p - arr[i - 1] : 0).slice(1);
  const consecutive = recentMoves.slice(-5).filter(m => type === "BOOM" ? m < 0 : m > 0).length;
  const momentumFactor = Math.min(consecutive / 5, 1);

  // Time since last spike: longer = more likely
  const msSinceLastSpike = Date.now() - st.lastSpikeTime;
  const timeFactor = Math.min(msSinceLastSpike / 20000, 1);

  // Combined probability
  const spikeProbability = Math.min((extremeFactor * 0.5 + momentumFactor * 0.3 + timeFactor * 0.2) * 100, 95);

  // Estimated spike magnitude
  const volatilityFactor = 1000 / num;
  const estimatedMagnitude = ((0.015 + extremeFactor * 0.05) * volatilityFactor * 100).toFixed(1);

  return {
    type,
    number: num,
    currentPrice: st.price,
    spikeProbability: Math.round(spikeProbability),
    expectedDirection,
    estimatedMagnitude: `${estimatedMagnitude}%`,
    timeSinceLastSpike: Math.round(msSinceLastSpike / 1000),
    isSpikeImminent: spikeProbability > 70,
    // Technical details for display
    pricePosition: Math.round(position * 100),
    consecutiveMoves: consecutive,
    rangeLow: minPrice,
    rangeHigh: maxPrice,
    timestamp: Date.now(),
  };
}

export function getSpikeHistory(type: IndexType, num: number) {
  const key = getKey(type, num);
  const logs = spikeLog[key] || [];
  const recentSpikes = logs.slice(-10).reverse().map((t) => ({
    time: t,
    timeAgo: Math.round((Date.now() - t) / 1000),
  }));

  return {
    type,
    number: num,
    totalSpikes: logs.length,
    recentSpikes,
  };
}
