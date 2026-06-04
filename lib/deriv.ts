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
  });
}

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateTick(type: IndexType, num: number, currentPrice: number, timestamp: number) {
  const seed = timestamp / 1000;
  const rand = seededRandom(seed);
  const spikeRand = seededRandom(seed + num);

  // Volatility decreases as number increases
  const volatilityFactor = 1000 / num;

  let change: number;

  if (type === "BOOM") {
    if (spikeRand > 0.97) {
      change = currentPrice * (0.01 + rand * 0.03) * volatilityFactor;
    } else {
      change = currentPrice * (rand * 0.002 - 0.0005) * (volatilityFactor * 0.5);
    }
  } else {
    if (spikeRand > 0.97) {
      change = -currentPrice * (0.01 + rand * 0.03) * volatilityFactor;
    } else {
      change = currentPrice * (rand * 0.002 - 0.0015) * (volatilityFactor * 0.5);
    }
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
      st.price = generateTick(idx.type, idx.number, st.price, t);
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
    };
  }

  return result;
}

export function predictNextTick(type: IndexType, num: number) {
  const key = getKey(type, num);
  const st = stateMap.get(key);

  if (!st) {
    return { error: "Index not found" };
  }

  const recentChanges = st.history.slice(-20).map((p, i, arr) => i > 0 ? p - arr[i - 1] : 0).slice(1);
  const avgChange = recentChanges.reduce((a, b) => a + b, 0) / (recentChanges.length || 1);
  const volatility = Math.sqrt(recentChanges.reduce((a, b) => a + b * b, 0) / (recentChanges.length || 1));

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
