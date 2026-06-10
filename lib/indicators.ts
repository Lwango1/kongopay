export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerBandsResult {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
}

export interface IchimokuResult {
  tenkan: number;
  kijun: number;
  senkouA: number;
  senkouB: number;
  chikou: number;
}

export function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length < period) return [];
  const multiplier = 2 / (period + 1);
  const ema: number[] = [];
  const sum = prices.slice(0, period).reduce((a, b) => a + b, 0);
  ema.push(sum / period);
  for (let i = period; i < prices.length; i++) {
    ema.push((prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]);
  }
  return ema;
}

export function calculateSMA(prices: number[], period: number): number[] {
  if (prices.length < period) return [];
  const sma: number[] = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  return sma;
}

export function calculateMACD(prices: number[], fast = 12, slow = 26, signalPeriod = 9): MACDResult | null {
  if (prices.length < slow + signalPeriod) return null;
  const fastEMA = calculateEMA(prices, fast);
  const slowEMA = calculateEMA(prices, slow);
  if (!fastEMA.length || !slowEMA.length) return null;
  const offset = prices.length - fastEMA.length;
  const macdLine: number[] = [];
  for (let i = 0; i < slowEMA.length; i++) {
    const idx = fastEMA.length - slowEMA.length + i;
    macdLine.push(fastEMA[idx] - slowEMA[i]);
  }
  const signalLine = calculateEMA(macdLine, signalPeriod);
  if (!signalLine.length) return null;
  const macd = macdLine[macdLine.length - 1];
  const signal = signalLine[signalLine.length - 1];
  return { macd, signal, histogram: macd - signal };
}

export function calculateBollingerBands(prices: number[], period = 20, multiplier = 2): BollingerBandsResult | null {
  if (prices.length < period) return null;
  const sma = calculateSMA(prices, period);
  if (!sma.length) return null;
  const middle = sma[sma.length - 1];
  const recent = prices.slice(-period);
  const variance = recent.reduce((sum, p) => sum + (p - middle) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    upper: middle + stdDev * multiplier,
    middle,
    lower: middle - stdDev * multiplier,
    bandwidth: (stdDev * 2 * multiplier) / middle,
  };
}

export function calculateIchimoku(prices: number[]): IchimokuResult | null {
  if (prices.length < 52) return null;
  const high52 = Math.max(...prices.slice(-52));
  const low52 = Math.min(...prices.slice(-52));
  const tenkanHigh = Math.max(...prices.slice(-9));
  const tenkanLow = Math.min(...prices.slice(-9));
  const kijunHigh = Math.max(...prices.slice(-26));
  const kijunLow = Math.min(...prices.slice(-26));
  const tenkan = (tenkanHigh + tenkanLow) / 2;
  const kijun = (kijunHigh + kijunLow) / 2;
  const senkouA = (tenkan + kijun) / 2;
  const senkouB = (high52 + low52) / 2;
  const chikou = prices.length > 26 ? prices[prices.length - 27] : prices[0];

  return { tenkan, kijun, senkouA, senkouB, chikou };
}

export function calculateATR(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 0;
  let sum = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    sum += Math.abs(prices[i] - prices[i - 1]);
  }
  return sum / period;
}

export function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  const recent = prices.slice(-period - 1);
  let gains = 0, losses = 0;
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  return 100 - 100 / (1 + gains / losses);
}

export function calculateStochasticRSI(prices: number[], rsiPeriod = 14, stochPeriod = 14): number {
  const rsiValues: number[] = [];
  for (let i = rsiPeriod; i < prices.length; i++) {
    rsiValues.push(calculateRSI(prices.slice(0, i + 1), rsiPeriod));
  }
  if (rsiValues.length < stochPeriod) return 50;
  const recentRsi = rsiValues.slice(-stochPeriod);
  const minRsi = Math.min(...recentRsi);
  const maxRsi = Math.max(...recentRsi);
  if (maxRsi === minRsi) return 50;
  return ((rsiValues[rsiValues.length - 1] - minRsi) / (maxRsi - minRsi)) * 100;
}

export function calculateOBV(prices: number[]): number {
  let obv = 0;
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) obv += prices[i];
    else if (prices[i] < prices[i - 1]) obv -= prices[i];
  }
  return obv;
}

export function calculateVWAP(prices: number[]): number {
  if (prices.length === 0) return 0;
  const total = prices.reduce((sum, p, i) => sum + p * (i + 1), 0);
  const volume = (prices.length * (prices.length + 1)) / 2;
  return total / volume;
}
