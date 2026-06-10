export interface CandlePattern {
  name: string;
  signal: "bullish" | "bearish" | "neutral";
  strength: number;
  description: string;
}

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

function isDoji(candle: Candle, threshold = 0.001): boolean {
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  return range > 0 && body / range < threshold;
}

function isHammer(candle: Candle): boolean {
  const body = Math.abs(candle.close - candle.open);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const totalRange = candle.high - candle.low;
  if (totalRange === 0) return false;
  return body < totalRange * 0.3 && lowerWick > body * 2 && upperWick < body * 0.5;
}

function isShootingStar(candle: Candle): boolean {
  const body = Math.abs(candle.close - candle.open);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const totalRange = candle.high - candle.low;
  if (totalRange === 0) return false;
  return body < totalRange * 0.3 && upperWick > body * 2 && lowerWick < body * 0.5;
}

function isBullishEngulfing(prev: Candle, curr: Candle): boolean {
  return prev.close < prev.open && curr.close > curr.open
    && curr.open < prev.close && curr.close > prev.open;
}

function isBearishEngulfing(prev: Candle, curr: Candle): boolean {
  return prev.close > prev.open && curr.close < curr.open
    && curr.open > prev.close && curr.close < prev.open;
}

function isBullishHarami(prev: Candle, curr: Candle): boolean {
  return prev.close < prev.open && curr.close > curr.open
    && curr.open > prev.close && curr.close < prev.open;
}

function isBearishHarami(prev: Candle, curr: Candle): boolean {
  return prev.close > prev.open && curr.close < curr.open
    && curr.open < prev.close && curr.close > prev.open;
}

function isPiercingLine(prev: Candle, curr: Candle): boolean {
  if (prev.close >= prev.open || curr.close <= curr.open) return false;
  const prevMid = (prev.high + prev.low) / 2;
  return curr.close > prevMid && curr.open < prev.low;
}

function isDarkCloudCover(prev: Candle, curr: Candle): boolean {
  if (prev.close <= prev.open || curr.close >= curr.open) return false;
  const prevMid = (prev.high + prev.low) / 2;
  return curr.close < prevMid && curr.open > prev.high;
}

function isMorningStar(prev: Candle, mid: Candle, curr: Candle): boolean {
  return prev.close < prev.open
    && Math.abs(mid.close - mid.open) < (prev.high - prev.low) * 0.3
    && curr.close > curr.open
    && curr.close > (prev.high + prev.low) / 2;
}

function isEveningStar(prev: Candle, mid: Candle, curr: Candle): boolean {
  return prev.close > prev.open
    && Math.abs(mid.close - mid.open) < (prev.high - prev.low) * 0.3
    && curr.close < curr.open
    && curr.close < (prev.high + prev.low) / 2;
}

function isMarubozu(candle: Candle): boolean {
  const body = Math.abs(candle.close - candle.open);
  const totalRange = candle.high - candle.low;
  if (totalRange === 0) return false;
  const wickRatio = (totalRange - body) / totalRange;
  return wickRatio < 0.05;
}

function isSpinningTop(candle: Candle): boolean {
  const body = Math.abs(candle.close - candle.open);
  const totalRange = candle.high - candle.low;
  if (totalRange === 0) return false;
  return body / totalRange > 0.3 && body / totalRange < 0.7;
}

function threeWhiteSoldiers(candles: Candle[]): boolean {
  if (candles.length < 3) return false;
  const c1 = candles[candles.length - 3];
  const c2 = candles[candles.length - 2];
  const c3 = candles[candles.length - 1];
  return c1.close > c1.open && c2.close > c2.open && c3.close > c3.open
    && c2.close > c1.close && c3.close > c2.close
    && c2.open > c1.open && c3.open > c2.open;
}

function threeBlackCrows(candles: Candle[]): boolean {
  if (candles.length < 3) return false;
  const c1 = candles[candles.length - 3];
  const c2 = candles[candles.length - 2];
  const c3 = candles[candles.length - 1];
  return c1.close < c1.open && c2.close < c2.open && c3.close < c3.open
    && c2.close < c1.close && c3.close < c2.close
    && c2.open < c1.open && c3.open < c2.open;
}

export function detectCandlestickPatterns(candles: Candle[]): CandlePattern[] {
  if (candles.length < 3) return [];
  const patterns: CandlePattern[] = [];
  const curr = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const mid = candles.length >= 3 ? candles[candles.length - 3] : prev;

  if (isDoji(curr, 0.001)) {
    patterns.push({ name: "Doji", signal: "neutral", strength: 1, description: "Indécision du marché" });
  }

  if (isHammer(curr)) {
    const isInDowntrend = prev.close < prev.open || candles.slice(-5).every(c => c.close < c.open);
    patterns.push({
      name: "Hammer", signal: "bullish", strength: isInDowntrend ? 3 : 1,
      description: "Possible retournement haussier",
    });
  }

  if (isShootingStar(curr)) {
    const isInUptrend = prev.close > prev.open || candles.slice(-5).every(c => c.close > c.open);
    patterns.push({
      name: "Shooting Star", signal: "bearish", strength: isInUptrend ? 3 : 1,
      description: "Possible retournement baissier",
    });
  }

  if (isBullishEngulfing(prev, curr)) {
    patterns.push({ name: "Engouffrement Haussier", signal: "bullish", strength: 3, description: "Forte pression acheteuse" });
  }

  if (isBearishEngulfing(prev, curr)) {
    patterns.push({ name: "Engouffrement Baissier", signal: "bearish", strength: 3, description: "Forte pression vendeuse" });
  }

  if (isBullishHarami(prev, curr)) {
    patterns.push({ name: "Harami Haussier", signal: "bullish", strength: 2, description: "Ralentissement baissier" });
  }

  if (isBearishHarami(prev, curr)) {
    patterns.push({ name: "Harami Baissier", signal: "bearish", strength: 2, description: "Ralentissement haussier" });
  }

  if (isPiercingLine(prev, curr)) {
    patterns.push({ name: "Piercing Line", signal: "bullish", strength: 2, description: "Retournement haussier potentiel" });
  }

  if (isDarkCloudCover(prev, curr)) {
    patterns.push({ name: "Dark Cloud Cover", signal: "bearish", strength: 2, description: "Retournement baissier potentiel" });
  }

  if (candles.length >= 3) {
    if (isMorningStar(candles[candles.length - 3], candles[candles.length - 2], curr)) {
      patterns.push({ name: "Morning Star", signal: "bullish", strength: 4, description: "Forte inversion haussière" });
    }
    if (isEveningStar(candles[candles.length - 3], candles[candles.length - 2], curr)) {
      patterns.push({ name: "Evening Star", signal: "bearish", strength: 4, description: "Forte inversion baissière" });
    }
  }

  if (isMarubozu(curr)) {
    const isBullish = curr.close > curr.open;
    patterns.push({
      name: `Marubozu ${isBullish ? "Haussier" : "Baissier"}`,
      signal: isBullish ? "bullish" : "bearish",
      strength: 2,
      description: `${isBullish ? "Acheteurs" : "Vendeurs"} dominants`,
    });
  }

  if (isSpinningTop(curr)) {
    patterns.push({ name: "Spinning Top", signal: "neutral", strength: 1, description: "Consolidation" });
  }

  if (candles.length >= 3) {
    if (threeWhiteSoldiers(candles)) {
      patterns.push({ name: "Trois Soldats Blancs", signal: "bullish", strength: 4, description: "Forte tendance haussière" });
    }
    if (threeBlackCrows(candles)) {
      patterns.push({ name: "Trois Corneilles Noires", signal: "bearish", strength: 4, description: "Forte tendance baissière" });
    }
  }

  return patterns;
}

export function getPatternSignal(patterns: CandlePattern[]): { signal: "bullish" | "bearish" | "neutral"; score: number } {
  let score = 0;
  for (const p of patterns) {
    if (p.signal === "bullish") score += p.strength;
    else if (p.signal === "bearish") score -= p.strength;
  }
  return {
    signal: score > 2 ? "bullish" : score < -2 ? "bearish" : "neutral",
    score,
  };
}
