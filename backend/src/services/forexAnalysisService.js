import WebSocket from 'ws';
import { broadcastSignal } from './pushNotifications.js';
import { calculateRSI, findSupportResistance, findOrderBlocks } from './analysis.js';

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

  // Keep SMT divergence detection for correlated pairs
  // (used in scanAll)

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

    const currentPrice = prices[prices.length - 1];
    const { nearestSupport, nearestResistance, allLevels } = findSupportResistance(prices, currentPrice);
    const orderBlocks = findOrderBlocks(prices);

    const threshold = Math.max(currentPrice * 0.003, 0.0005);

    // — BUY if price is near support —
    const atSupport = nearestSupport && Math.abs(currentPrice - nearestSupport.price) <= threshold;
    // — SELL if price is near resistance —
    const atResistance = nearestResistance && Math.abs(currentPrice - nearestResistance.price) <= threshold;

    // Level touched (within 0.08% in last 40 ticks)
    let supportTouched = false;
    let resistanceTouched = false;
    const tWindow = Math.min(prices.length, 40);
    for (let i = prices.length - tWindow; i < prices.length; i++) {
      if (nearestSupport && Math.abs(prices[i] - nearestSupport.price) / nearestSupport.price < 0.0008) supportTouched = true;
      if (nearestResistance && Math.abs(prices[i] - nearestResistance.price) / nearestResistance.price < 0.0008) resistanceTouched = true;
    }

    // Approaching detection (3 of last 10 ticks moving toward level)
    let approachingSupport = false;
    let approachingResistance = false;
    if (nearestSupport) {
      let c = 0;
      for (let i = Math.max(1, prices.length - 10); i < prices.length; i++) {
        if (prices[i] < prices[i - 1]) c++;
      }
      approachingSupport = c >= 3 && currentPrice > nearestSupport.price;
    }
    if (nearestResistance) {
      let c = 0;
      for (let i = Math.max(1, prices.length - 10); i < prices.length; i++) {
        if (prices[i] > prices[i - 1]) c++;
      }
      approachingResistance = c >= 3 && currentPrice < nearestResistance.price;
    }

    const isUpDirection = atSupport || (supportTouched && !atResistance);
    const isDownDirection = atResistance || (resistanceTouched && !atSupport);

    // If at both or neither -> no clear signal
    const noClearSignal = isUpDirection === isDownDirection;

    // Score based on S/R strength and proximity (0.0 – 1.0)
    const scoreLevel = (level, touched, approaching) => {
      if (!level) return 0;
      const prox = Math.max(0, 1 - Math.abs(currentPrice - level.price) / (currentPrice * 0.01));
      const str = Math.min(level.strength / 8, 1);
      let s = prox * 0.4 + str * 0.3;
      if (touched) s += 0.15;
      if (approaching) s += 0.1;
      return Math.min(s, 1);
    };

    const upScore = scoreLevel(nearestSupport, supportTouched, approachingSupport);
    const downScore = scoreLevel(nearestResistance, resistanceTouched, approachingResistance);

    // Determine direction (stabilized)
    const rawUp = upScore > downScore + 0.03;
    const stableUp = this._getStableDirection(key, rawUp);
    const hasLevel = stableUp ? !!nearestSupport : !!nearestResistance;

    if (noClearSignal || !hasLevel || (upScore < 0.3 && downScore < 0.3)) {
      return {
        key, currentPrice, probability: 0, expectedDirection: 'up', estimatedMagnitude: '0.0%',
        isSpikeImminent: false, levelTouched: false, isApproaching: false, signal: 'WATCH',
        entryPrice: Math.round(currentPrice * 10000) / 10000,
        stopLoss: Math.round(currentPrice * 10000) / 10000,
        takeProfit: Math.round(currentPrice * 10000) / 10000,
        rsi: 50, trend: 'ranging', regime: 'ranging', volatility: 'medium', killzone: this.detectKillzone(),
        fvg: null, ote: null, pdArray: null, displacement: null, orderBlocks: [],
        sRlevels: allLevels.slice(0, 6).map(l => ({ price: Math.round(l.price * 10000) / 10000, strength: l.strength, type: l.type })),
        candlePatterns: [], upScore: Math.round(upScore * 100), downScore: Math.round(downScore * 100),
      };
    }

    const refLevel = stableUp ? nearestSupport : nearestResistance;
    const refStrength = refLevel?.strength ?? 1;
    const bestScore = stableUp ? upScore : downScore;
    let probability = Math.round(Math.min(Math.max(bestScore * 100, 30), 95));
    const levelTouched = stableUp ? supportTouched : resistanceTouched;
    const isApproaching = stableUp ? approachingSupport : approachingResistance;

    // Order block confluence boost
    const nearOB = orderBlocks.find(ob =>
      Math.abs(ob.price - currentPrice) / currentPrice < 0.003 &&
      ((stableUp && ob.type === 'bullish') || (!stableUp && ob.type === 'bearish'))
    );
    if (nearOB) probability += 10;

    if (levelTouched && refStrength >= 3) probability += 8;
    if (isApproaching && refStrength >= 3) probability += 5;
    probability = Math.min(probability, 95);

    const isSpikeImminent = probability >= 70 && (levelTouched || isApproaching);

    // SL = beyond the S/R level, TP = 2× SL distance or next level
    const slBufferPct = stableUp ? Math.min(currentPrice - refLevel.price, currentPrice * 0.003) : Math.min(refLevel.price - currentPrice, currentPrice * 0.003);
    const slBuffer = Math.max(slBufferPct, currentPrice * 0.001);
    const stopLoss = stableUp ? Math.round((currentPrice - slBuffer * 1.2) * 10000) / 10000 : Math.round((currentPrice + slBuffer * 1.2) * 10000) / 10000;
    const takeProfit = stableUp ? Math.round((currentPrice + slBuffer * 2.4) * 10000) / 10000 : Math.round((currentPrice - slBuffer * 2.4) * 10000) / 10000;
    const magnitudePct = (slBuffer * 2.4 / currentPrice) * 100;

    const strongThreshold = 70;
    const signalThreshold = 55;
    const signal = probability >= strongThreshold
      ? (stableUp ? 'STRONG_BUY' : 'STRONG_SELL')
      : probability >= signalThreshold
        ? (stableUp ? 'BUY' : 'SELL')
        : 'WATCH';

    return {
      key, currentPrice, probability,
      expectedDirection: stableUp ? 'up' : 'down',
      estimatedMagnitude: `${magnitudePct.toFixed(1)}%`,
      isSpikeImminent, levelTouched, isApproaching, signal,
      entryPrice: Math.round(currentPrice * 10000) / 10000,
      stopLoss, takeProfit,
      rsi: 50, trend: 'ranging', regime: 'ranging', volatility: 'medium',
      killzone: this.detectKillzone(),
      fvg: null, ote: null, pdArray: null, displacement: null,
      orderBlocks: orderBlocks.slice(0, 3).map(ob => ({
        price: Math.round(ob.price * 10000) / 10000,
        type: ob.type,
        strength: ob.strength,
      })),
      sRlevels: allLevels.slice(0, 6).map(l => ({
        price: Math.round(l.price * 10000) / 10000,
        strength: l.strength, type: l.type,
      })),
      candlePatterns: [],
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
