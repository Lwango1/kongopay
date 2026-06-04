// Simulate Deriv synthetic indices (Boom & Crash)
// Boom: tends to spike up suddenly
// Crash: tends to drop suddenly

let boomPrice = 12500;
let crashPrice = 12500;
let boomHistory: number[] = [];
let crashHistory: number[] = [];

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateTick(type: "boom" | "crash", currentPrice: number, timestamp: number) {
  const seed = timestamp / 1000;
  const rand = seededRandom(seed);
  const spikeRand = seededRandom(seed + 999);

  let change: number;

  if (type === "boom") {
    // Boom has sudden upward spikes
    if (spikeRand > 0.97) {
      change = currentPrice * (0.02 + rand * 0.05); // +2% to +7% spike
    } else {
      change = currentPrice * (rand * 0.002 - 0.0005); // -0.05% to +0.15% drift
    }
  } else {
    // Crash has sudden downward drops
    if (spikeRand > 0.97) {
      change = -currentPrice * (0.02 + rand * 0.05); // -2% to -7% drop
    } else {
      change = currentPrice * (rand * 0.002 - 0.0015); // -0.15% to +0.05% drift
    }
  }

  const newPrice = Math.max(currentPrice + change, currentPrice * 0.5);
  return Math.round(newPrice * 100) / 100;
}

export function getDerivState() {
  const now = Date.now();

  for (let i = 0; i < 5; i++) {
    const t = now - (5 - i) * 200;
    boomPrice = generateTick("boom", boomPrice, t);
    crashPrice = generateTick("crash", crashPrice, t);
  }

  boomHistory.push(boomPrice);
  crashHistory.push(crashPrice);

  if (boomHistory.length > 200) boomHistory.shift();
  if (crashHistory.length > 200) crashHistory.shift();

  return {
    boom: {
      price: boomPrice,
      change24h: boomHistory.length > 1 ? ((boomPrice - boomHistory[0]) / boomHistory[0]) * 100 : 0,
      history: boomHistory.slice(-100),
    },
    crash: {
      price: crashPrice,
      change24h: crashHistory.length > 1 ? ((crashPrice - crashHistory[0]) / crashHistory[0]) * 100 : 0,
      history: crashHistory.slice(-100),
    },
    timestamp: now,
  };
}

export function predictNextTick(type: "boom" | "crash") {
  const state = getDerivState();
  const current = type === "boom" ? state.boom.price : state.crash.price;
  const history = type === "boom" ? state.boom.history : state.crash.history;

  const recentChanges = history.slice(-10).map((p, i, arr) => i > 0 ? p - arr[i - 1] : 0).slice(1);
  const avgChange = recentChanges.reduce((a, b) => a + b, 0) / recentChanges.length;
  const volatility = Math.sqrt(recentChanges.reduce((a, b) => a + b * b, 0) / recentChanges.length);

  const rand = Math.random();
  const prediction = rand > 0.5 ? "UP" : "DOWN";
  const confidence = Math.min(Math.abs(avgChange) / (volatility || 1) * 0.5 + 0.5, 0.95);

  return {
    type,
    currentPrice: current,
    prediction,
    confidence: Math.round(confidence * 100),
    timestamp: Date.now(),
  };
}
