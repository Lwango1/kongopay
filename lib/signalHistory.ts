const STORAGE_KEY = "kongopay_signal_history";

export interface HistoryEntry {
  key: string;
  label: string;
  direction: "up" | "down";
  probability: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  magnitude: string;
  detectedAt: number;
  expiredAt: number;
}

function getDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function loadAll(): Record<string, HistoryEntry[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, HistoryEntry[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable
  }
}

export function addToHistory(entry: HistoryEntry) {
  const all = loadAll();
  const day = getDayKey(entry.detectedAt);
  if (!all[day]) all[day] = [];
  all[day].push(entry);
  saveAll(all);
}

export function getTodayHistory(): HistoryEntry[] {
  const all = loadAll();
  const day = getDayKey(Date.now());
  return all[day] ?? [];
}

export function getHistoryForDay(date: Date): HistoryEntry[] {
  const all = loadAll();
  const day = getDayKey(date.getTime());
  return all[day] ?? [];
}

export function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
