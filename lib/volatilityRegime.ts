export type VolatilityRegime = "high" | "medium" | "low";
export type MarketRegime = "trending_bull" | "trending_bear" | "ranging" | "volatile" | "calm";

export interface RegimeAnalysis {
  volatility: VolatilityRegime;
  market: MarketRegime;
  atrRatio: number;
  adx: number;
  trendStrength: number;
  recommendation: string;
}

export function detectVolatilityRegime(prices: number[]): VolatilityRegime {
  if (prices.length < 50) return "medium";
  const atr14 = calculateATRInternal(prices, 14);
  const atr50 = calculateATRInternal(prices, 50);
  if (atr14 === 0 || atr50 === 0) return "medium";
  const ratio = atr14 / atr50;
  if (ratio > 1.5) return "high";
  if (ratio < 0.7) return "low";
  return "medium";
}

function calculateATRInternal(prices: number[], period: number): number {
  if (prices.length < period + 1) return 0;
  let sum = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    sum += Math.abs(prices[i] - prices[i - 1]);
  }
  return sum / period;
}

export function calculateADX(prices: number[], period = 14): number {
  if (prices.length < period * 2) return 25;
  const avgPrice = prices.map((p, i) => i > 0 ? (p + prices[i - 1]) / 2 : p);
  const upMoves: number[] = [];
  const downMoves: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const upMove = prices[i] - prices[i - 1];
    const downMove = prices[i - 1] - prices[i];
    upMoves.push(upMove > 0 ? upMove : 0);
    downMoves.push(downMove > 0 ? downMove : 0);
  }
  const smoothedUp = calculateSMInternal(upMoves, period);
  const smoothedDown = calculateSMInternal(downMoves, period);
  const diPlus: number[] = [];
  const diMinus: number[] = [];
  for (let i = 0; i < smoothedUp.length; i++) {
    const sum = smoothedUp[i] + smoothedDown[i];
    if (sum > 0) {
      diPlus.push((smoothedUp[i] / sum) * 100);
      diMinus.push((smoothedDown[i] / sum) * 100);
    } else {
      diPlus.push(0);
      diMinus.push(0);
    }
  }
  const dx: number[] = [];
  for (let i = 0; i < diPlus.length; i++) {
    const diff = Math.abs(diPlus[i] - diMinus[i]);
    const sum = diPlus[i] + diMinus[i];
    dx.push(sum > 0 ? (diff / sum) * 100 : 0);
  }
  if (dx.length < period) return 25;
  const adx = calculateSMInternal(dx.slice(-period), period);
  return adx.length > 0 ? adx[adx.length - 1] : 25;
}

function calculateSMInternal(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const result: number[] = [];
  const sum = values.slice(0, period).reduce((a, b) => a + b, 0);
  result.push(sum / period);
  for (let i = period; i < values.length; i++) {
    result.push((result[result.length - 1] * (period - 1) + values[i]) / period);
  }
  return result;
}

export function detectTrendStrength(prices: number[]): number {
  if (prices.length < 40) return 0;
  const short = prices.slice(-10);
  const medium = prices.slice(-20);
  const long = prices.slice(-40);
  const shortAvg = short.reduce((a, b) => a + b, 0) / short.length;
  const mediumAvg = medium.reduce((a, b) => a + b, 0) / medium.length;
  const longAvg = long.reduce((a, b) => a + b, 0) / long.length;
  const shortSlope = (short[short.length - 1] - short[0]) / short.length;
  const mediumSlope = (medium[medium.length - 1] - medium[0]) / medium.length;
  const longSlope = (long[long.length - 1] - long[0]) / long.length;
  const basePrice = longAvg || 1;
  let strength = 0;
  if (shortSlope > 0 && mediumSlope > 0 && longSlope > 0) {
    strength = ((shortSlope / basePrice) * 100 + (mediumSlope / basePrice) * 50 + (longSlope / basePrice) * 25) * 10;
  } else if (shortSlope < 0 && mediumSlope < 0 && longSlope < 0) {
    strength = -(Math.abs(shortSlope / basePrice) * 100 + Math.abs(mediumSlope / basePrice) * 50 + Math.abs(longSlope / basePrice) * 25) * 10;
  }
  return Math.max(-100, Math.min(100, strength));
}

export function analyzeRegime(prices: number[]): RegimeAnalysis {
  const volatility = detectVolatilityRegime(prices);
  const adx = calculateADX(prices);
  const trendStrength = detectTrendStrength(prices);
  let market: MarketRegime;
  let recommendation: string;

  const isTrendingStrong = adx > 25;

  if (isTrendingStrong && trendStrength > 15) {
    market = "trending_bull";
    recommendation = "Forte tendance haussière. Privilégier les signaux BUY, éviter les contre-tendances.";
  } else if (isTrendingStrong && trendStrength < -15) {
    market = "trending_bear";
    recommendation = "Forte tendance baissière. Privilégier les signaux SELL, éviter les contre-tendances.";
  } else if (volatility === "high") {
    market = "volatile";
    recommendation = "Volatilité élevée. Augmenter les stops, réduire la taille des positions.";
  } else if (volatility === "low" && adx < 20) {
    market = "calm";
    recommendation = "Marché calme. Attendre des confirmations supplémentaires avant d'entrer.";
  } else {
    market = "ranging";
    recommendation = "Marché range. Utiliser les niveaux de support/résistance, scalping recommandé.";
  }

  return {
    volatility,
    market,
    adx: Math.round(adx * 10) / 10,
    trendStrength: Math.round(trendStrength * 10) / 10,
    recommendation,
  };
}
