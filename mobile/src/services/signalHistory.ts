import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'kongopay_signal_history';

export type MobileHistoryEntry = {
  key: string;
  label: string;
  direction: string;
  probability: number;
  magnitude: string;
  detectedAt: number;
  expiredAt: number;
};

function getDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export async function addToHistory(entry: MobileHistoryEntry) {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const all: Record<string, MobileHistoryEntry[]> = raw ? JSON.parse(raw) : {};
    const day = getDayKey(entry.detectedAt);
    if (!all[day]) all[day] = [];
    all[day].push(entry);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export async function getTodayHistory(): Promise<MobileHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all: Record<string, MobileHistoryEntry[]> = JSON.parse(raw);
    const day = getDayKey(Date.now());
    return all[day] ?? [];
  } catch {
    return [];
  }
}

export async function clearHistory() {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {}
}
