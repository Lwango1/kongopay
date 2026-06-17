// Analyse technique partagée entre Deriv, Crypto, et autres marchés

export function calculateATR(prices, period = 14) {
  if (prices.length < period + 1) return 0;
  const trs = [];
  for (let i = prices.length - period; i < prices.length; i++) {
    const high = Math.max(prices[i], prices[i - 1] || prices[i]);
    const low = Math.min(prices[i], prices[i - 1] || prices[i]);
    trs.push(high - low);
  }
  return trs.reduce((a, b) => a + b, 0) / trs.length;
}

export function calculateRSI(prices, period = 14) {
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

export function calculateMomentum(prices, period = 10) {
  if (prices.length < period) return 0;
  const slice = prices.slice(-period);
  return (slice[slice.length - 1] - slice[0]) / slice[0];
}

export function findPivots(prices, lookback = 3) {
  const pivots = [];
  for (let i = lookback; i < prices.length - lookback; i++) {
    const curr = prices[i];
    const left = prices.slice(i - lookback, i);
    const right = prices.slice(i + 1, i + lookback + 1);
    const isHigh = left.every(p => curr > p) && right.every(p => curr > p);
    const isLow = left.every(p => curr < p) && right.every(p => curr < p);
    if (isHigh) {
      const existing = pivots.find(p => p.isHigh && Math.abs(p.price - curr) / curr < 0.002);
      if (existing) { existing.strength++; existing.price = (existing.price + curr) / 2; }
      else pivots.push({ price: curr, isHigh: true, strength: 1 });
    }
    if (isLow) {
      const existing = pivots.find(p => !p.isHigh && Math.abs(p.price - curr) / curr < 0.002);
      if (existing) { existing.strength++; existing.price = (existing.price + curr) / 2; }
      else pivots.push({ price: curr, isHigh: false, strength: 1 });
    }
  }
  return pivots;
}

export function findSupportResistance(prices, currentPrice) {
  const pivots3 = findPivots(prices.slice(-80), 3);
  const pivots5 = findPivots(prices.slice(-120), 5);

  const allPivots = [...pivots3, ...pivots5];
  const clusters = [];

  for (const p of allPivots) {
    const existing = clusters.find(c => Math.abs(c.price - p.price) / p.price < 0.003 && c.isHigh === p.isHigh);
    if (existing) {
      existing.price = (existing.price * existing.strength + p.price * p.strength) / (existing.strength + p.strength);
      existing.strength += p.strength;
    } else {
      clusters.push({ price: p.price, strength: p.strength, isHigh: p.isHigh });
    }
  }

  const supports = clusters.filter(c => c.price < currentPrice)
    .map(c => ({ price: c.price, strength: c.strength, type: 'support' }))
    .sort((a, b) => b.price - a.price);

  const resistances = clusters.filter(c => c.price > currentPrice)
    .map(c => ({ price: c.price, strength: c.strength, type: 'resistance' }))
    .sort((a, b) => a.price - b.price);

  const scoreLevel = (level) => {
    const distPct = Math.abs(level.price - currentPrice) / currentPrice;
    const distScore = Math.max(0, 1 - distPct / 0.03);
    return distScore * 0.3 + Math.min(level.strength / 8, 1) * 0.7;
  };

  const getStrongest = (levels) => {
    if (levels.length === 0) return null;
    return levels.reduce((best, l) => scoreLevel(l) > scoreLevel(best) ? l : best);
  };

  return {
    nearestSupport: getStrongest(supports),
    nearestResistance: getStrongest(resistances),
    allLevels: [...supports, ...resistances].sort((a, b) => b.strength - a.strength),
  };
}

export function analyzeMarketStructure(prices) {
  const recent = prices.slice(-60);
  if (recent.length < 20) return { trend: 'ranging', lastBreakout: null, liquiditySwept: false, imbalance: 0 };
  const pivots = findPivots(recent, 5);
  const highs = pivots.filter(p => p.isHigh).sort((a, b) => b.price - a.price);
  const lows = pivots.filter(p => !p.isHigh).sort((a, b) => a.price - b.price);
  const higherHigh = highs.length >= 2 && highs[0].price > highs[1].price;
  const higherLow = lows.length >= 2 && lows[0].price > lows[1].price;
  const lowerHigh = highs.length >= 2 && highs[0].price < highs[1].price;
  const lowerLow = lows.length >= 2 && lows[0].price < lows[1].price;
  let trend = 'ranging';
  if (higherHigh && higherLow) trend = 'uptrend';
  else if (lowerHigh && lowerLow) trend = 'downtrend';
  const currentPrice = recent[recent.length - 1];
  const lastHigh = highs[0]?.price ?? currentPrice;
  const lastLow = lows[0]?.price ?? currentPrice;
  const liquiditySwept = currentPrice > lastHigh * 1.001 || currentPrice < lastLow * 0.999;
  const shortAvg = prices.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const longAvg = prices.slice(-40).reduce((a, b) => a + b, 0) / 40;
  const imbalance = (shortAvg - longAvg) / longAvg;
  return { trend, lastBreakout: liquiditySwept ? (currentPrice > lastHigh ? 'bullish' : 'bearish') : null, liquiditySwept, imbalance };
}

export function findOrderBlocks(prices) {
  const blocks = [];
  const recent = prices.slice(-200);
  if (recent.length < 30) return blocks;
  const avgMove = calculateATR(recent) / (recent.reduce((a, b) => a + b, 0) / recent.length);
  const bodyThreshold = Math.max(avgMove * 1.5, 0.0008);
  for (let i = 5; i < recent.length - 5; i++) {
    const candle = recent[i], prev = recent[i - 1];
    const next1 = recent[i + 1], next2 = recent[i + 2], next3 = recent[i + 3];
    const change = candle - prev;
    const bodySize = Math.abs(change) / candle;
    if (bodySize < bodyThreshold) continue;
    const low = Math.min(candle, prev), high = Math.max(candle, prev);
    if (change < 0 && next1 > candle && next2 > candle && next3 > candle) {
      const existing = blocks.find(b => b.type === 'bullish' && Math.abs(b.price - low) / (low || 1) < 0.002);
      if (existing) { existing.strength++; existing.price = (existing.price * (existing.strength - 1) + low) / existing.strength; }
      else blocks.push({ price: low, type: 'bullish', strength: 1, rangeLow: low, rangeHigh: high });
    }
    if (change > 0 && next1 < candle && next2 < candle && next3 < candle) {
      const existing = blocks.find(b => b.type === 'bearish' && Math.abs(b.price - high) / (high || 1) < 0.002);
      if (existing) { existing.strength++; existing.price = (existing.price * (existing.strength - 1) + high) / existing.strength; }
      else blocks.push({ price: high, type: 'bearish', strength: 1, rangeLow: low, rangeHigh: high });
    }
  }
  return blocks.sort((a, b) => b.strength - a.strength).slice(0, 6);
}

export function analyzeRegime(prices) {
  if (prices.length < 50) return { volatility: 'medium', market: 'ranging', adx: 25, recommendation: 'Données insuffisantes' };
  const atr14 = calculateATR(prices, 14);
  const atr50 = calculateATR(prices, 50);
  const volatility = atr50 > 0 ? (atr14 / atr50 > 1.5 ? 'high' : atr14 / atr50 < 0.7 ? 'low' : 'medium') : 'medium';
  const trendStrength = calculateMomentum(prices, 40);
  let market, recommendation;
  if (Math.abs(trendStrength) > 0.02 && atr14 > 0) {
    market = trendStrength > 0 ? 'trending_bull' : 'trending_bear';
    recommendation = market === 'trending_bull' ? 'Tendance haussière' : 'Tendance baissière';
  } else if (volatility === 'high') {
    market = 'volatile';
    recommendation = 'Volatilité élevée, stops larges';
  } else if (atr14 / (atr50 || 1) < 0.7) {
    market = 'calm';
    recommendation = 'Marché calme, attendre';
  } else {
    market = 'ranging';
    recommendation = 'Range, scalping recommandé';
  }
  return { volatility, market, adx: Math.round(atr14 * 1000) / 100, recommendation };
}

export function detectCandlestickPatterns(candles) {
  if (candles.length < 3) return [];
  const patterns = [];
  const curr = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const body = Math.abs(curr.close - curr.open);
  const range = curr.high - curr.low;
  if (range > 0 && body / range < 0.001) patterns.push({ name: 'Doji', signal: 'neutral', strength: 1 });
  const lowerWick = Math.min(curr.open, curr.close) - curr.low;
  const upperWick = curr.high - Math.max(curr.open, curr.close);
  if (range > 0 && body < range * 0.3 && lowerWick > body * 2 && upperWick < body * 0.5) patterns.push({ name: 'Hammer', signal: 'bullish', strength: 3 });
  if (range > 0 && body < range * 0.3 && upperWick > body * 2 && lowerWick < body * 0.5) patterns.push({ name: 'Shooting Star', signal: 'bearish', strength: 3 });
  if (prev.close < prev.open && curr.close > curr.open && curr.open < prev.close && curr.close > prev.open) patterns.push({ name: 'Bullish Engulfing', signal: 'bullish', strength: 3 });
  if (prev.close > prev.open && curr.close < curr.open && curr.open > prev.close && curr.close < prev.open) patterns.push({ name: 'Bearish Engulfing', signal: 'bearish', strength: 3 });
  return patterns;
}

export function getPatternSignal(patterns) {
  let score = 0;
  for (const p of patterns) {
    if (p.signal === 'bullish') score += p.strength;
    else if (p.signal === 'bearish') score -= p.strength;
  }
  return { signal: score > 2 ? 'bullish' : score < -2 ? 'bearish' : 'neutral', score };
}

export function predictCrypto(type, num, history, currentPrice, candleMap15m, candleMap30m, candleMap60m, candleMap120m, key, lastSpikeTime) {
  if (!history || history.length < 30) {
    return { error: 'Pas assez de données historiques' };
  }

  const vol = calculateATR(history);
  const rsiVal = calculateRSI(history);
  const market = analyzeMarketStructure(history);
  const { nearestSupport, nearestResistance, allLevels } = findSupportResistance(history, currentPrice);
  const orderBlocks = findOrderBlocks(history);
  const regime = analyzeRegime(history);

  const prices30m = candleMap30m?.get?.(key)?.map(c => c.close) || [];
  const prices60m = candleMap60m?.get?.(key)?.map(c => c.close) || [];
  const prices120m = candleMap120m?.get?.(key)?.map(c => c.close) || [];
  const candles15m = candleMap15m?.get?.(key) || [];
  const candlePatterns = detectCandlestickPatterns(candles15m);
  const patternSignal = getPatternSignal(candlePatterns);

  // Score for both directions
  const upRef = nearestSupport?.price ?? Math.min(...history.slice(-20));
  const upStr = nearestSupport?.strength ?? 1;
  const downRef = nearestResistance?.price ?? Math.max(...history.slice(-20));
  const downStr = nearestResistance?.strength ?? 1;

  const avgPrice = (currentPrice + upRef) / 2 || currentPrice;
  const atrRatio = avgPrice > 0 ? vol / avgPrice : 0.001;
  const volScale = Math.max(atrRatio / 0.0005, 0.5);
  const maxDistPct = Math.min(0.025 * volScale, 0.05);
  const maxDistance = avgPrice * maxDistPct;

  // --- Score UP (support bounce) ---
  const upDist = Math.abs(currentPrice - upRef);
  const upProx = Math.max(0, 1 - upDist / maxDistance);
  let upFactor = Math.min(upProx, 1);
  if (currentPrice < upRef) upFactor *= 0.2;

  const upConsec = history.slice(-5).filter((p, i, arr) => i > 0 && p < arr[i - 1]).length;
  const upMomentum = Math.min(upConsec / 5, 1);

  let upScore = upFactor * 0.35 + upMomentum * 0.12 + Math.min(upStr / 5, 1) * 0.08;

  // --- Score DOWN (resistance rejection) ---
  const downDist = Math.abs(currentPrice - downRef);
  const downProx = Math.max(0, 1 - downDist / maxDistance);
  let downFactor = Math.min(downProx, 1);
  if (currentPrice > downRef) downFactor *= 0.2;

  const downConsec = history.slice(-5).filter((p, i, arr) => i > 0 && p > arr[i - 1]).length;
  const downMomentum = Math.min(downConsec / 5, 1);

  let downScore = downFactor * 0.35 + downMomentum * 0.12 + Math.min(downStr / 5, 1) * 0.08;

  // --- Indicator bonuses ---
  const addIndicators = (score, isUp) => {
    let bonus = 0;
    if (isUp && market.trend === 'uptrend') bonus += 0.06;
    else if (!isUp && market.trend === 'downtrend') bonus += 0.06;
    else if (market.trend === 'ranging') bonus += 0.03;
    if (isUp && market.liquiditySwept && market.lastBreakout === 'bullish') bonus += 0.05;
    else if (!isUp && market.liquiditySwept && market.lastBreakout === 'bearish') bonus += 0.05;
    if (isUp && rsiVal < 25) bonus += 0.04;
    else if (!isUp && rsiVal > 75) bonus += 0.04;
    if (orderBlocks.length > 0) {
      const nearOB = Math.abs(orderBlocks[0].price - currentPrice) / currentPrice < 0.005;
      if (nearOB && ((isUp && orderBlocks[0].type === 'bullish') || (!isUp && orderBlocks[0].type === 'bearish'))) bonus += 0.05;
    }
    if (regime.market === 'trending_bull' && isUp) bonus += 0.04;
    else if (regime.market === 'trending_bear' && !isUp) bonus += 0.04;
    else if (regime.market === 'volatile') bonus += 0.02;
    if ((isUp && patternSignal.signal === 'bullish') || (!isUp && patternSignal.signal === 'bearish')) {
      bonus += Math.min(patternSignal.score / 20, 0.04);
    }
    return Math.min(score + bonus, 1);
  };

  upScore = addIndicators(upScore, true);
  downScore = addIndicators(downScore, false);

  // --- Multi-TF ---
  const addMTF = (score, isUp, tfPrices) => {
    if (tfPrices.length < 10) return score;
    const rsiTF = calculateRSI(tfPrices);
    const marketTF = analyzeMarketStructure(tfPrices);
    const { nearestSupport: s, nearestResistance: r } = findSupportResistance(tfPrices, currentPrice);
    const ref = isUp ? (s?.price ?? Math.min(...tfPrices.slice(-20))) : (r?.price ?? Math.max(...tfPrices.slice(-20)));
    const str = isUp ? (s?.strength ?? 1) : (r?.strength ?? 1);
    const dist = Math.abs(currentPrice - ref);
    const prox = Math.max(0, 1 - dist / (avgPrice * maxDistPct));
    const tfScore = prox * 0.35 + Math.min(str / 5, 1) * 0.08;
    return tfScore > 0.5 ? score + 0.06 : score - 0.04;
  };

  upScore = addMTF(upScore, true, prices30m);
  upScore = addMTF(upScore, true, prices60m);
  upScore = addMTF(upScore, true, prices120m);
  downScore = addMTF(downScore, false, prices30m);
  downScore = addMTF(downScore, false, prices60m);
  downScore = addMTF(downScore, false, prices120m);

  upScore = Math.min(Math.max(upScore, 0), 1);
  downScore = Math.min(Math.max(downScore, 0), 1);

  // --- Determine direction and final probability ---
  const isUpDirection = upScore >= downScore;
  const bestScore = isUpDirection ? upScore : downScore;
  const refLevel = isUpDirection ? upRef : downRef;
  const refStrength = isUpDirection ? upStr : downStr;

  const msSinceLastSpike = Date.now() - lastSpikeTime;
  // Time factor non-linéaire: lent au début, accélère après 15min
  const normalizedTime = Math.min(msSinceLastSpike / (30 * 60 * 1000), 1);
  const timeFactor = normalizedTime * normalizedTime * (3 - 2 * normalizedTime); // smoothstep
  let probability = Math.min(Math.max(bestScore * 100 + timeFactor * 8, 20), 97);

  // --- isApproaching ---
  let isApproaching = false;
  let approachVelocity = 0;
  const approachLevel = isUpDirection ? nearestSupport?.price : nearestResistance?.price;
  if (approachLevel) {
    const recent10 = history.slice(-10);
    let towardCount = 0;
    for (let i = 1; i < recent10.length; i++) {
      const priceRise = recent10[i] > recent10[i - 1];
      const levelAbove = approachLevel > currentPrice;
      const movingToward = levelAbove ? priceRise : !priceRise;
      if (movingToward) towardCount++;
    }
    const slice = history.slice(-8);
    const slope = (slice[slice.length - 1] - slice[0]) / slice.length;
    const avgP = (currentPrice + approachLevel) / 2 || 1;
    approachVelocity = Math.abs(slope) / avgP / (volScale || 1);
    const rsiRecent = calculateRSI(history.slice(-30));
    const rsiDivergence = (isUpDirection && rsiRecent < 40) || (!isUpDirection && rsiRecent > 60);
    isApproaching = (towardCount >= 3 || approachVelocity > 0.3) || (towardCount >= 2 && rsiDivergence);
  }

  // --- levelTouched ---
  let levelTouched = false;
  const touchThreshold = 0.0008;
  const touchWindow = Math.min(history.length, 40);
  if (isUpDirection && nearestSupport) {
    for (let i = history.length - touchWindow; i < history.length; i++) {
      if (Math.abs(history[i] - nearestSupport.price) / nearestSupport.price < touchThreshold) { levelTouched = true; break; }
    }
  } else if (!isUpDirection && nearestResistance) {
    for (let i = history.length - touchWindow; i < history.length; i++) {
      if (Math.abs(history[i] - nearestResistance.price) / nearestResistance.price < touchThreshold) { levelTouched = true; break; }
    }
  }

  const isSpikeImminent = probability >= (volScale > 1.5 ? 72 : 75) && (levelTouched || isApproaching);

  // --- Magnitude ---
  const lookback = Math.min(history.length, 100);
  const recentHigh = Math.max(...history.slice(-lookback));
  const recentLow = Math.min(...history.slice(-lookback));
  const recentRange = currentPrice > 0 ? (recentHigh - recentLow) / currentPrice : 0.005;
  const magnitudePct = (0.008 + bestScore * 0.04) * (recentRange / 0.005) * volScale;
  const magnitudeStr = `${(magnitudePct * 100).toFixed(1)}%`;

  const pricePos = nearestSupport && nearestResistance
    ? Math.round(((currentPrice - nearestSupport.price) / (nearestResistance.price - nearestSupport.price)) * 100)
    : 50;

  // --- Entry / SL / TP ---
  const predictive = isApproaching && !levelTouched;
  let entryLevel;
  if (predictive) {
    entryLevel = isUpDirection ? currentPrice * 0.998 : currentPrice * 1.002;
  } else {
    entryLevel = isUpDirection
      ? Math.min(nearestSupport?.price ?? currentPrice * 0.99, currentPrice * 0.998)
      : Math.max(nearestResistance?.price ?? currentPrice * 1.01, currentPrice * 1.002);
  }

  const slMult = regime.market === 'volatile' ? 0.8 : regime.market === 'calm' ? 0.4 : 0.6;
  const tpMult = regime.market === 'volatile' ? 2.2 : regime.market === 'calm' ? 1.4 : 1.8;
  const slBuffer = Math.max(vol * slMult, currentPrice * 0.003);
  const stopLoss = isUpDirection
    ? (predictive ? entryLevel * 0.998 : Math.min(entryLevel * 0.996, entryLevel - slBuffer))
    : (predictive ? entryLevel * 1.002 : Math.max(entryLevel * 1.004, entryLevel + slBuffer));
  const tpTarget = predictive ? vol * 1.2 : vol * 0.8;
  const takeProfit = isUpDirection
    ? Math.max(entryLevel + tpTarget, currentPrice + tpTarget)
    : Math.min(entryLevel - tpTarget, currentPrice - tpTarget);

  const strongThreshold = 86;
  const signalThreshold = volScale > 1.5 ? 78 : 82;
  const signal = isUpDirection
    ? (probability >= strongThreshold ? 'STRONG_BUY' : probability >= signalThreshold ? 'BUY' : 'WATCH')
    : (probability >= strongThreshold ? 'STRONG_SELL' : probability >= signalThreshold ? 'SELL' : 'WATCH');

  return {
    type, number: num, currentPrice,
    spikeProbability: Math.round(Math.min(probability, 97)),
    expectedDirection: isUpDirection ? 'up' : 'down',
    estimatedMagnitude: magnitudeStr,
    timeSinceLastSpike: Math.round(msSinceLastSpike / 1000),
    isSpikeImminent,
    levelTouched,
    isApproaching,
    approachVelocity: Math.round(approachVelocity * 100) / 100,
    pricePosition: pricePos,
    consecutiveMoves: isUpDirection ? upConsec : downConsec,
    rangeLow: nearestSupport?.price ?? currentPrice * 0.98,
    rangeHigh: nearestResistance?.price ?? currentPrice * 1.02,
    referenceLevel: Math.round(refLevel * 100) / 100,
    referenceStrength: refStrength,
    distancePercent: Math.round(Math.abs(currentPrice - refLevel) / (refLevel || currentPrice) * 10000) / 100,
    sRlevels: allLevels.slice(0, 6).map(l => ({ price: Math.round(l.price * 100) / 100, strength: l.strength, type: l.type })),
    orderBlocks: orderBlocks.slice(0, 4).map(ob => ({ price: Math.round(ob.price * 100) / 100, type: ob.type, strength: ob.strength })),
    upScore: Math.round(upScore * 100),
    downScore: Math.round(downScore * 100),
    regime: { volatility: regime.volatility, market: regime.market, recommendation: regime.recommendation },
    candlePatterns: candlePatterns.slice(0, 3).map(p => ({ name: p.name, signal: p.signal, strength: p.strength })),
    entryPrice: Math.round(entryLevel * 100) / 100,
    stopLoss: Math.round(stopLoss * 100) / 100,
    takeProfit: Math.round(takeProfit * 100) / 100,
    signal,
    connected: true,
    timestamp: Date.now(),
    volScale: Math.round(volScale * 100) / 100,
  };
}
