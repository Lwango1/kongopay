// Mobile Deriv service — connects to backend API (Deriv WebSocket live data)

export interface IndexData {
  price: number;
  change24h: number;
  history: number[];
  type: string;
  number: number;
  lastSpikeTime: number;
  lastSpikeDirection: 'up' | 'down' | null;
  connected: boolean;
}

export interface SpikePrediction {
  spikeProbability: number;
  expectedDirection: string;
  estimatedMagnitude: string;
  timeSinceLastSpike: number;
  isSpikeImminent: boolean;
  levelTouched?: boolean;
  isApproaching?: boolean;
  approachVelocity?: number;
  pricePosition: number;
  consecutiveMoves: number;
  upScore?: number;
  downScore?: number;
  regime?: { volatility: string; market: string; recommendation: string };
  candlePatterns?: { name: string; signal: string; strength: number }[];
  orderBlocks?: { price: number; type: string; strength: number }[];
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  volScale?: number;
  error?: string;
}

export type DerivState = Record<string, IndexData>;
export type SpikeMap = Record<string, SpikePrediction>;

const API_BASE = 'http://localhost:3000/api/deriv';

export const INDICES = [
  { type: 'BOOM', number: 500, label: 'Boom 500', color: '#22c55e' },
  { type: 'BOOM', number: 900, label: 'Boom 900', color: '#16a34a' },
  { type: 'BOOM', number: 1000, label: 'Boom 1000', color: '#15803d' },
  { type: 'CRASH', number: 500, label: 'Crash 500', color: '#fb7185' },
  { type: 'CRASH', number: 900, label: 'Crash 900', color: '#f43f5e' },
  { type: 'CRASH', number: 1000, label: 'Crash 1000', color: '#be123c' },
];

export async function fetchDerivState(): Promise<{ indices: DerivState; source: string }> {
  const res = await fetch(`${API_BASE}/state`);
  if (!res.ok) throw new Error('Deriv API unavailable');
  const data = await res.json();
  const { timestamp, source, ...indices } = data;
  return { indices: indices as DerivState, source };
}

export async function fetchSpikePrediction(type: string, number: number): Promise<SpikePrediction | null> {
  try {
    const res = await fetch(`${API_BASE}/spike?type=${type}&number=${number}`);
    if (res.ok) {
      const data = await res.json();
      return data.prediction ?? data;
    }
  } catch { /* ignore */ }
  return null;
}

export interface MarketOpportunity {
  type: string;
  number: number;
  label: string;
  currentPrice: number;
  change24h: number;
  spikeProbability: number;
  expectedDirection: string;
  estimatedMagnitude: string;
  isSpikeImminent: boolean;
  levelTouched?: boolean;
  isApproaching?: boolean;
  approachVelocity?: number;
  timeSinceLastSpike: number;
  pricePosition: number;
  consecutiveMoves: number;
  upScore?: number;
  downScore?: number;
  regime?: { volatility: string; market: string; recommendation: string };
  candlePatterns?: { name: string; signal: string; strength: number }[];
  orderBlocks?: { price: number; type: string; strength: number }[];
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  volScale?: number;
  connected: boolean;
  timestamp: number;
}

export interface MarketScanResult {
  timestamp: number;
  source: string;
  opportunities: MarketOpportunity[];
  bestOpportunity: MarketOpportunity | null;
  imminentCount: number;
  totalAnalyzed: number;
}

export async function fetchMarketScan(): Promise<MarketScanResult | null> {
  try {
    const res = await fetch(`${API_BASE}/scan`);
    if (res.ok) return await res.json();
  } catch { /* ignore */ }
  return null;
}
