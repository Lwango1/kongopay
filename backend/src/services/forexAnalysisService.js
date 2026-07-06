import WebSocket from 'ws';
import { broadcastSignal } from './pushNotifications.js';
import {
  calculateATR, calculateRSI, calculateMomentum,
  findPivots, findSupportResistance, analyzeMarketStructure,
  findOrderBlocks, analyzeRegime, detectCandlestickPatterns,
  getPatternSignal,
} from './analysis.js';

const FOREX_SYMBOLS = [
  { symbol: 'frxEURUSD', pair: 'EUR/USD', type: 'forex', group: 'eur' },
  { symbol: 'frxGBPUSD', pair: 'GBP/USD', type: 'forex', group: 'gbp' },
  { symbol: 'frxUSDJPY', pair: 'USD/JPY', type: 'forex', group: 'jpy' },
  { symbol: 'frxUSDCHF', pair: 'USD/CHF', type: 'forex', group: 'chf' },
  { symbol: 'frxAUDUSD', pair: 'AUD/USD', type: 'forex', group: 'aud' },
  { symbol: 'frxUSDCAD', pair: 'USD/CAD', type: 'forex', group: 'cad' },
  { symbol: 'frxNZDUSD', pair: 'NZD/USD', type: 'forex', group: 'nzd' },
  { symbol: 'frxXAUUSD', pair: 'XAU/USD', type: 'commodity', group: 'gold' },
];

const DERIV_WS_URL = 'wss://ws.derivws.com/websockets/v3?app_id=1089&l=EN';
const CACHE_TTL = 60 * 1000;

function now() { return Date.now(); }

function buildCandleKey(symbol) {
  return symbol.replace('frx', '');
}

function floorTime(ms, seconds) {
  return Math.floor(ms / 1000 / seconds) * seconds;
}

class ForexAnalysisService {
  constructor() {
    this.candles = new Map(); // key -> { 15m, 30m, 1h, 2h }
    this.prices = new Map();
    this.ws = null;
    this.connected = false;
    this.cache = { data: null, timestamp: 0 };
    this.directionMemory = new Map(); // key -> { history: string[], lockedUntil: number }
    this.broadcastedSignals = new Set();

    for (const { symbol } of FOREX_SYMBOLS) {
      const key = buildCandleKey(symbol);
      this.candles.set(key, {
        prices: [],
        m15: [], m30: [], h1: [], h2: [],
      });
      this.prices.set(key, { price: 0, bid: 0, ask: 0, timestamp: 0 });
      this.directionMemory.set(key, { history: [], lockedUntil: 0 });
    }
  }

  _getStableDirection(key, proposedUp) {
    const mem = this.directionMemory.get(key);
    if (!mem) return proposedUp;
    const now = Date.now();

    if (now < mem.lockedUntil) {
      const prev = mem.history[mem.history.length - 1];
      if (prev !== undefined) return prev;
    }

    mem.history.push(proposedUp ? 'up' : 'down');
    if (mem.history.length > 3) mem.history.shift();

    const upCount = mem.history.filter(d => d === 'up').length;
    const majorityUp = upCount >= 2;
    const prev = mem.history[mem.history.length - 2];

    if (prev !== undefined && prev !== (majorityUp ? 'up' : 'down')) {
      mem.lockedUntil = now + 120000;
    }

    return majorityUp;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    try {
      this.ws = new WebSocket(DERIV_WS_URL);
      this.ws.on('open', () => {
        this.connected = true;
        for (const { symbol } of FOREX_SYMBOLS) {
          this.ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
        }
        console.log('[ForexAnalysis] Connecté, abonné à', FOREX_SYMBOLS.length, 'symboles');
      });

      this.ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.msg_type === 'tick' && msg.tick) {
            this.handleTick(msg.tick);
          }
        } catch {}
      });

      this.ws.on('close', () => { this.connected = false; setTimeout(() => this.connect(), 5000); });
      this.ws.on('error', () => { this.connected = false; setTimeout(() => this.connect(), 5000); });
    } catch {}
  }

  handleTick(tick) {
    const key = buildCandleKey(tick.symbol);
    if (!this.candles.has(key)) return;

    const price = tick.quote;
    const timeMs = (tick.epoch || Math.floor(Date.now() / 1000)) * 1000;

    const entry = this.prices.get(key);
    entry.price = price;
    entry.timestamp = timeMs;

    const store = this.candles.get(key);
    store.prices.push(price);
    if (store.prices.length > 500) store.prices.shift();

    const intervals = [
      { seconds: 900, arr: store.m15 },   // 15m
      { seconds: 1800, arr: store.m30 },  // 30m
      { seconds: 3600, arr: store.h1 },   // 1h
      { seconds: 7200, arr: store.h2 },   // 2h
    ];

    for (const { seconds, arr } of intervals) {
      const t = floorTime(timeMs, seconds);
      if (arr.length === 0 || arr[arr.length - 1].time !== t) {
        arr.push({ time: t, open: price, high: price, low: price, close: price });
        if (arr.length > 200) arr.shift();
      } else {
        const last = arr[arr.length - 1];
        last.high = Math.max(last.high, price);
        last.low = Math.min(last.low, price);
        last.close = price;
      }
    }
  }

  getClosePrices(arr) {
    return arr.map(c => c.close);
  }

  // ─── SMC / ICT Concepts ─────────────────────────────────────────

  detectFVG(candles, prices) {
    if (candles.length >= 3) return this._detectFVGCandles(candles);
    if (prices && prices.length >= 15) {
      const clusters = [];
      for (let i = 3; i < prices.length; i++) {
        const gap = prices[i] - prices[i - 2];
        if (Math.abs(gap) / (prices[i - 2] || 1) > 0.001) {
          clusters.push({
            type: gap > 0 ? 'bullish' : 'bearish',
            bottom: Math.min(prices[i - 2], prices[i]),
            top: Math.max(prices[i - 2], prices[i]),
            mid: (prices[i - 2] + prices[i]) / 2,
            strength: 1,
            time: Date.now(),
          });
        }
      }
      return clusters.slice(-6);
    }
    return [];
  }

  _detectFVGCandles(candles) {
    if (candles.length < 3) return [];
    const fvgs = [];
    for (let i = 2; i < candles.length; i++) {
      const c1 = candles[i - 2], c2 = candles[i - 1], c3 = candles[i];
      const gapUp = c2.low > c1.high && c3.high < c2.low;
      const gapDown = c2.high < c1.low && c3.low > c2.high;
      if (gapUp) {
        const existing = fvgs.find(f => f.type === 'bullish' && Math.abs(f.top - c2.low) / (c2.low || 1) < 0.002);
        if (existing) existing.strength++;
        else fvgs.push({ type: 'bullish', top: c2.low, bottom: c1.high, mid: (c2.low + c1.high) / 2, strength: 1, time: c2.time });
      }
      if (gapDown) {
        const existing = fvgs.find(f => f.type === 'bearish' && Math.abs(f.bottom - c2.high) / (c2.high || 1) < 0.002);
        if (existing) existing.strength++;
        else fvgs.push({ type: 'bearish', top: c1.low, bottom: c2.high, mid: (c1.low + c2.high) / 2, strength: 1, time: c2.time });
      }
    }
    return fvgs.slice(-6);
  }

  isFVGMitigated(price, fvg) {
    if (!fvg) return false;
    return price >= fvg.bottom && price <= fvg.top;
  }

  detectOTE(prices) {
    if (prices.length < 20) return null;
    const recent = prices.slice(-30);
    const high = Math.max(...recent);
    const low = Math.min(...recent);
    const range = high - low;
    if (range === 0) return null;
    return {
      high, low, range,
      entryZone: { low: high - range * 0.79, high: high - range * 0.618 },
      isBullish: prices[prices.length - 1] > prices[0],
    };
  }

  isPriceInOTE(price, ote) {
    if (!ote) return false;
    return price >= ote.entryZone.low && price <= ote.entryZone.high;
  }

  detectPDArray(prices) {
    if (prices.length < 20) return null;
    const recent = prices.slice(-30);
    const high = Math.max(...recent);
    const low = Math.min(...recent);
    const mid = (high + low) / 2;
    const current = prices[prices.length - 1];
    return {
      high, low, mid,
      zone: current >= mid ? 'premium' : 'discount',
      distanceFromMid: ((current - mid) / (mid || 1)) * 100,
    };
  }

  detectDisplacement(candles) {
    if (candles.length < 3) return { detected: false };
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    if (!last || !prev) return { detected: false };
    const bodySize = Math.abs(last.close - last.open);
    const avgBody = candles.slice(-10).reduce((s, c) => s + Math.abs(c.close - c.open), 0) / 10;
    if (avgBody === 0) return { detected: false };
    const ratio = bodySize / avgBody;
    if (ratio > 2.0 && bodySize > (last.high - last.low) * 0.7) {
      return {
        detected: true,
        direction: last.close > last.open ? 'bullish' : 'bearish',
        ratio: Math.round(ratio * 10) / 10,
        bodySize,
      };
    }
    return { detected: false };
  }

  detectSMTDivergence(analysisResults) {
    const divergences = [];
    const correlatedPairs = [
      { a: 'EURUSD', b: 'USDCHF', inverse: true },
      { a: 'GBPUSD', b: 'USDCHF', inverse: true },
      { a: 'GBPUSD', b: 'EURUSD', inverse: false },
      { a: 'AUDUSD', b: 'NZDUSD', inverse: false },
      { a: 'EURUSD', b: 'XAUUSD', inverse: true },
    ];

    for (const { a, b, inverse } of correlatedPairs) {
      const aData = analysisResults.get(a);
      const bData = analysisResults.get(b);
      if (!aData || !bData) continue;
      if (aData.prices.length < 20 || bData.prices.length < 20) continue;

      const aRecent = aData.prices.slice(-15);
      const bRecent = bData.prices.slice(-15);
      const aDir = aRecent[aRecent.length - 1] > aRecent[0] ? 'up' : 'down';
      const bDir = bRecent[bRecent.length - 1] > bRecent[0] ? 'up' : 'down';

      if (inverse) {
        if (aDir === 'up' && bDir === 'up') {
          const aRsi = calculateRSI(aData.prices, 14);
          const bRsi = calculateRSI(bData.prices, 14);
          if ((aRsi > 70 && bRsi < 30) || (aRsi < 30 && bRsi > 70)) {
            divergences.push({
              pairA: a, pairB: b, type: 'hidden',
              aRsi: Math.round(aRsi), bRsi: Math.round(bRsi),
              aDirection: aDir, bDirection: bDir,
              signal: aRsi > 70 ? 'bearish' : 'bullish',
              strength: Math.round(Math.abs(aRsi - bRsi) / 5),
            });
          }
        }
      } else {
        if (aDir !== bDir) {
          divergences.push({
            pairA: a, pairB: b, type: 'regular',
            aDirection: aDir, bDirection: bDir,
            signal: aDir === 'up' ? 'bearish' : 'bullish',
            strength: 1,
          });
        }
      }
    }
    return divergences;
  }

  detectKillzone() {
    const d = new Date();
    const utcHours = d.getUTCHours();
    const utcMinutes = d.getUTCMinutes();
    const totalMinutes = utcHours * 60 + utcMinutes;

    // Asian: 0-4 UTC (overlaps previous NY)
    // London Open: 7-9 UTC
    // NY Open: 13-15 UTC
    // London Close: 15-17 UTC

    const zones = [
      { name: 'Asian', start: 0, end: 4 * 60 },
      { name: 'London Open', start: 7 * 60, end: 9 * 60 },
      { name: 'NY Open', start: 13 * 60, end: 15 * 60 },
      { name: 'London Close', start: 15 * 60, end: 17 * 60 },
    ];

    const active = zones.find(z => totalMinutes >= z.start && totalMinutes < z.end);
    return active ? active.name : 'Off hours';
  }

  analyzePair(key) {
    const store = this.candles.get(key);
    if (!store) return null;
    const prices = store.prices;
    if (prices.length < 15) return null;

    const m15 = store.m15;
    const m30 = store.m30;
    const h1 = store.h1;
    const h2 = store.h2;

    const currentPrice = prices[prices.length - 1];
    const atr = calculateATR(prices);
    const rsi = calculateRSI(prices);
    const market = analyzeMarketStructure(prices);
    const { nearestSupport, nearestResistance, allLevels } = findSupportResistance(prices, currentPrice);
    const orderBlocks = findOrderBlocks(prices);
    const regime = analyzeRegime(prices);
    const tfCandles = m15.length >= 3 ? m15 : (m30.length >= 3 ? m30 : (h1.length >= 3 ? h1 : null));
    const fvgs = this.detectFVG(tfCandles || m15, prices);
    const ote = this.detectOTE(prices);
    const pd = this.detectPDArray(prices);
    const displacement = this.detectDisplacement(m15);
    const killzone = this.detectKillzone();
    const patterns = tfCandles ? detectCandlestickPatterns(tfCandles) : [];
    const patternSignal = getPatternSignal(patterns);

    const activeFVG = fvgs.length > 0 ? fvgs[fvgs.length - 1] : null;
    const fvgMitigated = activeFVG ? this.isFVGMitigated(currentPrice, activeFVG) : false;
    const inOTE = ote ? this.isPriceInOTE(currentPrice, ote) : false;

    const avgPrice = (currentPrice + (nearestSupport?.price || currentPrice)) / 2 || currentPrice;
    const atrRatio = avgPrice > 0 ? atr / avgPrice : 0.001;
    const volScale = Math.max(atrRatio / 0.0005, 0.5);
    const maxDistPct = Math.min(0.025 * volScale, 0.05);
    const maxDistance = avgPrice * maxDistPct;

    // --- Score UP (support bounce / buy-side) ---
    const upRef = nearestSupport?.price ?? Math.min(...prices.slice(-20));
    const upStr = nearestSupport?.strength ?? 1;
    const upDist = Math.abs(currentPrice - upRef);
    const upProx = Math.max(0, 1 - upDist / maxDistance);
    let upFactor = Math.min(upProx, 1);
    if (currentPrice < upRef) upFactor *= 0.2;

    const upConsec = prices.slice(-5).filter((p, i, arr) => i > 0 && p < arr[i - 1]).length;
    const upMomentum = Math.min(upConsec / 5, 1);
    let upScore = upFactor * 0.35 + upMomentum * 0.12 + Math.min(upStr / 5, 1) * 0.08;

    // --- Score DOWN (resistance rejection / sell-side) ---
    const downRef = nearestResistance?.price ?? Math.max(...prices.slice(-20));
    const downStr = nearestResistance?.strength ?? 1;
    const downDist = Math.abs(currentPrice - downRef);
    const downProx = Math.max(0, 1 - downDist / maxDistance);
    let downFactor = Math.min(downProx, 1);
    if (currentPrice > downRef) downFactor *= 0.2;

    const downConsec = prices.slice(-5).filter((p, i, arr) => i > 0 && p > arr[i - 1]).length;
    const downMomentum = Math.min(downConsec / 5, 1);
    let downScore = downFactor * 0.35 + downMomentum * 0.12 + Math.min(downStr / 5, 1) * 0.08;

    // --- SMC/ICT bonuses ---
    const addBonuses = (score, isUp) => {
      let bonus = 0;
      if (isUp && market.trend === 'uptrend') bonus += 0.05;
      else if (!isUp && market.trend === 'downtrend') bonus += 0.05;
      else if (market.trend === 'ranging') bonus += 0.02;

      if (isUp && market.liquiditySwept && market.lastBreakout === 'bullish') bonus += 0.05;
      else if (!isUp && market.liquiditySwept && market.lastBreakout === 'bearish') bonus += 0.05;

      if (isUp && rsi < 30) bonus += 0.04;
      else if (!isUp && rsi > 70) bonus += 0.04;

      if (orderBlocks.length > 0) {
        const nearOB = Math.abs(orderBlocks[0].price - currentPrice) / currentPrice < 0.003;
        if (nearOB && ((isUp && orderBlocks[0].type === 'bullish') || (!isUp && orderBlocks[0].type === 'bearish'))) bonus += 0.06;
      }

      // FVG bonus
      if (activeFVG && !fvgMitigated) {
        const nearFVG = Math.abs(activeFVG.mid - currentPrice) / currentPrice < 0.003;
        if (nearFVG && ((isUp && activeFVG.type === 'bullish') || (!isUp && activeFVG.type === 'bearish'))) bonus += 0.05;
      }

      // OTE bonus
      if (inOTE) {
        bonus += 0.04;
      }

      // PD Array bonus
      if (pd) {
        if (isUp && pd.zone === 'discount') bonus += 0.03;
        else if (!isUp && pd.zone === 'premium') bonus += 0.03;
      }

      // Displacement bonus
      if (displacement.detected) {
        if ((isUp && displacement.direction === 'bullish') || (!isUp && displacement.direction === 'bearish')) bonus += 0.03;
      }

      // Killzone bonus (London/NY = higher probability)
      if (killzone === 'London Open' || killzone === 'NY Open') bonus += 0.03;

      // Candlestick pattern bonus
      if ((isUp && patternSignal.signal === 'bullish') || (!isUp && patternSignal.signal === 'bearish')) {
        bonus += Math.min(patternSignal.score / 20, 0.04);
      }

      return Math.min(score + bonus, 1);
    };

    upScore = addBonuses(upScore, true);
    downScore = addBonuses(downScore, false);

    // Multi-TF confirmation
    const addMTF = (score, isUp, tfPrices) => {
      if (tfPrices.length < 10) return score;
      const rsiTF = calculateRSI(tfPrices);
      const mTF = analyzeMarketStructure(tfPrices);
      const { nearestSupport: s, nearestResistance: r } = findSupportResistance(tfPrices, currentPrice);
      const ref = isUp ? (s?.price ?? Math.min(...tfPrices.slice(-20))) : (r?.price ?? Math.max(...tfPrices.slice(-20)));
      const str = isUp ? (s?.strength ?? 1) : (r?.strength ?? 1);
      const dist = Math.abs(currentPrice - ref);
      const prox = Math.max(0, 1 - dist / (avgPrice * maxDistPct));
      const tfScore = prox * 0.35 + Math.min(str / 5, 1) * 0.08;
      return tfScore > 0.5 ? score + 0.05 : score - 0.03;
    };

    upScore = addMTF(upScore, true, this.getClosePrices(m30));
    upScore = addMTF(upScore, true, this.getClosePrices(h1));
    downScore = addMTF(downScore, false, this.getClosePrices(m30));
    downScore = addMTF(downScore, false, this.getClosePrices(h1));

    upScore = Math.min(Math.max(upScore, 0), 1);
    downScore = Math.min(Math.max(downScore, 0), 1);

    // Determine direction (stabilized — prevents flip-flopping)
    const rawUp = upScore > downScore + 0.03;
    const isUpDirection = this._getStableDirection(key, rawUp);
    const bestScore = isUpDirection ? upScore : downScore;
    const refLevel = isUpDirection ? upRef : downRef;
    const refStrength = isUpDirection ? upStr : downStr;

    let probability = Math.min(Math.max(bestScore * 100, 20), 95);

    // Approaching detection
    let isApproaching = false;
    const approachLevel = isUpDirection ? nearestSupport?.price : nearestResistance?.price;
    if (approachLevel) {
      const recent10 = prices.slice(-10);
      let towardCount = 0;
      for (let i = 1; i < recent10.length; i++) {
        const priceRise = recent10[i] > recent10[i - 1];
        const levelAbove = approachLevel > currentPrice;
        if (levelAbove ? priceRise : !priceRise) towardCount++;
      }
      isApproaching = towardCount >= 3;
    }

    // Level touched
    let levelTouched = false;
    const touchThreshold = 0.0008;
    const touchWindow = Math.min(prices.length, 40);
    if (isUpDirection && nearestSupport) {
      for (let i = prices.length - touchWindow; i < prices.length; i++) {
        if (Math.abs(prices[i] - nearestSupport.price) / nearestSupport.price < touchThreshold) { levelTouched = true; break; }
      }
    } else if (!isUpDirection && nearestResistance) {
      for (let i = prices.length - touchWindow; i < prices.length; i++) {
        if (Math.abs(prices[i] - nearestResistance.price) / nearestResistance.price < touchThreshold) { levelTouched = true; break; }
      }
    }

    // Boost probability when RSI extremes align with S/R levels
    const nearLevel = upDist < maxDistance * 0.3 || downDist < maxDistance * 0.3;
    if (nearLevel) {
      const rsiBoost = rsi < 20 ? 15 : rsi < 30 ? 10 : rsi > 80 ? 15 : rsi > 70 ? 10 : 0;
      probability += rsiBoost * (isUpDirection && rsi < 30 ? 1 : !isUpDirection && rsi > 70 ? 1 : 0.5);
    }
    // Boost when approaching with valid S/R
    if (isApproaching && refStrength >= 3) probability += 8;
    if (levelTouched && refStrength >= 3) probability += 5;
    // OTE proximity boost
    if (inOTE) probability += 8;
    // Active FVG boost
    if (activeFVG && !fvgMitigated) probability += 6;
    // Displacement boost
    if (displacement.detected) probability += 10;
    probability = Math.min(Math.max(Math.round(probability), 20), 95);

    const isSpikeImminent = probability >= 70 && (levelTouched || isApproaching);

    const lookback = Math.min(prices.length, 100);
    const recentHigh = Math.max(...prices.slice(-lookback));
    const recentLow = Math.min(...prices.slice(-lookback));
    const recentRange = currentPrice > 0 ? (recentHigh - recentLow) / currentPrice : 0.005;
    const magnitudePct = (0.005 + bestScore * 0.03) * (recentRange / 0.005) * volScale;
    const magnitudeStr = `${(magnitudePct * 100).toFixed(1)}%`;

    const slMult = regime.market === 'volatile' ? 0.8 : regime.market === 'calm' ? 0.4 : 0.6;
    const tpMult = regime.market === 'volatile' ? 2.2 : regime.market === 'calm' ? 1.4 : 1.8;
    const slBuffer = Math.max(atr * slMult, currentPrice * 0.002);
    const stopLoss = isUpDirection ? currentPrice - slBuffer : currentPrice + slBuffer;
    const takeProfit = isUpDirection ? currentPrice + slBuffer * tpMult : currentPrice - slBuffer * tpMult;

    const strongThreshold = 70;
    const signalThreshold = 55;
    const signal = probability >= strongThreshold
      ? (isUpDirection ? 'STRONG_BUY' : 'STRONG_SELL')
      : probability >= signalThreshold
        ? (isUpDirection ? 'BUY' : 'SELL')
        : 'WATCH';

    return {
      key,
      currentPrice,
      probability: Math.round(probability),
      expectedDirection: isUpDirection ? 'up' : 'down',
      estimatedMagnitude: magnitudeStr,
      isSpikeImminent,
      levelTouched,
      isApproaching,
      signal,
      entryPrice: Math.round(currentPrice * 10000) / 10000,
      stopLoss: Math.round(stopLoss * 10000) / 10000,
      takeProfit: Math.round(takeProfit * 10000) / 10000,
      rsi: Math.round(rsi),
      trend: market.trend,
      regime: regime.market,
      volatility: regime.volatility,
      killzone,
      fvg: activeFVG ? {
        type: activeFVG.type,
        bottom: Math.round(activeFVG.bottom * 10000) / 10000,
        top: Math.round(activeFVG.top * 10000) / 10000,
        mitigated: fvgMitigated,
      } : null,
      ote: inOTE ? {
        low: Math.round(ote.entryZone.low * 10000) / 10000,
        high: Math.round(ote.entryZone.high * 10000) / 10000,
      } : null,
      pdArray: pd ? { zone: pd.zone, distanceFromMid: Math.round(pd.distanceFromMid * 100) / 100 } : null,
      displacement: displacement.detected ? { direction: displacement.direction, ratio: displacement.ratio } : null,
      orderBlocks: orderBlocks.slice(0, 3).map(ob => ({
        price: Math.round(ob.price * 10000) / 10000,
        type: ob.type,
        strength: ob.strength,
      })),
      sRlevels: allLevels.slice(0, 6).map(l => ({
        price: Math.round(l.price * 10000) / 10000,
        strength: l.strength,
        type: l.type,
      })),
      candlePatterns: patterns.slice(0, 3).map(p => ({ name: p.name, signal: p.signal, strength: p.strength })),
      upScore: Math.round(upScore * 100),
      downScore: Math.round(downScore * 100),
    };
  }

  startAutoBroadcast(intervalMs = 120000) {
    this.broadcastedSignals = new Set();
    this._broadcastTimer = setInterval(() => {
      const result = this.scanAll();
      if (!result.connected || !result.signals.length) return;
      for (const sig of result.signals) {
        if (sig.probability < 65) continue;
        const key = `${sig.pair}|${sig.expectedDirection}|${Math.round(sig.probability / 10) * 10}`;
        if (this.broadcastedSignals.has(key)) continue;
        this.broadcastedSignals.add(key);
        if (this.broadcastedSignals.size > 200) this.broadcastedSignals.clear();
        broadcastSignal({
          pair: sig.pair,
          expectedDirection: sig.expectedDirection,
          probability: sig.probability,
          signal: sig.signal,
          entryPrice: sig.entryPrice,
          stopLoss: sig.stopLoss,
          takeProfit: sig.takeProfit,
          currentPrice: sig.currentPrice,
          killzone: sig.killzone,
          label: `${sig.pair} ${sig.signal}`,
          spikeProbability: sig.probability,
          type: 'FOREX',
          number: '',
          estimatedMagnitude: sig.estimatedMagnitude,
        }).catch(() => {});
        console.log(`[ForexAnalysis] Push signal: ${sig.pair} ${sig.signal} ${sig.probability}%`);
      }
    }, intervalMs);
    console.log(`[ForexAnalysis] Auto-broadcast démarré toutes les ${intervalMs / 1000}s`);
  }

  scanAll() {
    if (!this.connected) return { connected: false, pairs: [], signals: [], source: 'disconnected' };

    const results = [];
    const analysisResults = new Map();

    for (const { symbol, pair, type } of FOREX_SYMBOLS) {
      const key = buildCandleKey(symbol);
      const store = this.candles.get(key);
      if (!store || store.prices.length < 15) continue;

      const analysis = this.analyzePair(key);
      if (analysis) {
        analysis.pair = pair;
        analysis.type = type;
        analysisResults.set(key, { ...analysis, prices: store.prices });
        results.push(analysis);
      }
    }

    // SMT Divergence
    const divergences = this.detectSMTDivergence(analysisResults);

    const signals = results
      .filter(r => r.signal !== 'WATCH')
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 10);

    return {
      connected: true,
      pairs: results,
      signals,
      divergences,
      killzone: this.detectKillzone(),
      source: 'forex-analysis',
      timestamp: now(),
    };
  }
}

export const forexAnalysis = new ForexAnalysisService();
