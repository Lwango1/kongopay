const DB_NAME = "kongopay_signals";
const DB_VERSION = 1;
const STORE_NAME = "signals";

export interface SignalRecord {
  id?: number;
  key: string;
  label: string;
  type: string;
  number: number;
  direction: "up" | "down";
  probability: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  magnitude: string;
  timeSinceLastSpike: number;
  detectedAt: number;
  expiredAt: number;
  resolvedAt: number | null;
  result: "win" | "loss" | "timeout" | "active" | null;
  exitPrice: number | null;
  exitReason: string | null;
  currentPriceAtExpiry: number | null;
  maxFavorable: number;
  maxAdverse: number;
}

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB not available"));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        store.createIndex("key", "key", { unique: false });
        store.createIndex("detectedAt", "detectedAt", { unique: false });
        store.createIndex("status", "result", { unique: false });
        store.createIndex("label", "label", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSignal(signal: Omit<SignalRecord, "id">): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(signal);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function resolveSignal(id: number, updates: Partial<SignalRecord>) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const req = store.get(id);
  req.onsuccess = () => {
    const record = req.result;
    if (record) {
      Object.assign(record, updates);
      store.put(record);
    }
  };
}

export async function getRecentSignals(limit = 100): Promise<SignalRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("detectedAt");
    const req = index.openCursor(null, "prev");
    const results: SignalRecord[] = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getSignalStats(): Promise<{
  total: number; wins: number; losses: number; timeouts: number;
  winRate: number; roi: number; profitFactor: number;
  byMarket: Record<string, { total: number; wins: number; losses: number; winRate: number }>;
}> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const signals: SignalRecord[] = req.result;
      const closed = signals.filter(s => s.result && s.result !== "active");
      const total = closed.length;
      const wins = closed.filter(s => s.result === "win").length;
      const losses = closed.filter(s => s.result === "loss").length;
      const timeouts = closed.filter(s => s.result === "timeout").length;
      const winRate = total > 0 ? (wins / total) * 100 : 0;

      let totalReturn = 0;
      let totalRisk = 0;
      for (const s of closed) {
        if (s.result === "win") {
          const risk = Math.abs(s.entryPrice - s.stopLoss);
          const reward = Math.abs(s.takeProfit - s.entryPrice);
          totalReturn += reward / risk;
          totalRisk += 1;
        } else if (s.result === "loss") {
          totalReturn -= 1;
          totalRisk += 1;
        }
      }
      const roi = totalRisk > 0 ? (totalReturn / totalRisk) * 100 : 0;
      const profitFactor = losses > 0 ? wins / losses : wins > 0 ? Infinity : 0;

      const byMarket: Record<string, { total: number; wins: number; losses: number; winRate: number }> = {};
      for (const s of closed) {
        if (!byMarket[s.key]) byMarket[s.key] = { total: 0, wins: 0, losses: 0, winRate: 0 };
        byMarket[s.key].total++;
        if (s.result === "win") byMarket[s.key].wins++;
        if (s.result === "loss") byMarket[s.key].losses++;
      }
      for (const key of Object.keys(byMarket)) {
        const m = byMarket[key];
        m.winRate = m.total > 0 ? (m.wins / m.total) * 100 : 0;
      }

      resolve({ total, wins, losses, timeouts, winRate, roi, profitFactor, byMarket });
    };
    req.onerror = () => reject(req.error);
  });
}

export async function checkAndResolveSignals(getCurrentPrice: (key: string) => number | null) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const index = store.index("result");
  const req = index.getAll("active");
  req.onsuccess = () => {
    const active: SignalRecord[] = req.result;
    const now = Date.now();
    for (const signal of active) {
      const price = getCurrentPrice(signal.key);
      if (!price) continue;

      const diff = signal.direction === "up" ? price - signal.entryPrice : signal.entryPrice - price;
      const maxFav = Math.max(signal.maxFavorable || 0, diff);
      const maxAdv = Math.max(signal.maxAdverse || 0, -diff);

      let result: "win" | "loss" | "timeout" | null = null;
      let exitPrice: number | null = null;
      let exitReason: string | null = null;

      if (signal.direction === "up" && price >= signal.takeProfit) {
        result = "win"; exitPrice = signal.takeProfit; exitReason = "take_profit";
      } else if (signal.direction === "down" && price <= signal.takeProfit) {
        result = "win"; exitPrice = signal.takeProfit; exitReason = "take_profit";
      } else if (signal.direction === "up" && price <= signal.stopLoss) {
        result = "loss"; exitPrice = signal.stopLoss; exitReason = "stop_loss";
      } else if (signal.direction === "down" && price >= signal.stopLoss) {
        result = "loss"; exitPrice = signal.stopLoss; exitReason = "stop_loss";
      }

      if (!result && now > signal.expiredAt) {
        result = "timeout"; exitPrice = price; exitReason = "expired";
      }

      if (result) {
        store.put({
          ...signal,
          result,
          exitPrice,
          exitReason,
          resolvedAt: now,
          currentPriceAtExpiry: price,
          maxFavorable: maxFav,
          maxAdverse: maxAdv,
        });
      } else {
        store.put({ ...signal, maxFavorable: maxFav, maxAdverse: maxAdv });
      }
    }
  };
}
