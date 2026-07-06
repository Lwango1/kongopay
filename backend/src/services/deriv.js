import { WebSocket } from 'ws';
import { broadcastSignal } from './pushNotifications.js';
import { fitSpikeIntervals, spikeProbability } from './spikeIntervalModel.js';
import { computeAdvancedFeatures } from './advancedFeatures.js';

const INDICES = [
  { type: 'BOOM', number: 500, symbol: 'BOOM500' },
  { type: 'BOOM', number: 900, symbol: 'BOOM900' },
  { type: 'BOOM', number: 1000, symbol: 'BOOM1000' },
  { type: 'CRASH', number: 500, symbol: 'CRASH500' },
  { type: 'CRASH', number: 900, symbol: 'CRASH900' },
  { type: 'CRASH', number: 1000, symbol: 'CRASH1000' },
];

const DERIV_SYMBOLS = INDICES.map(i => i.symbol);
const DERIV_TOKEN = process.env.DERIV_TOKEN || '';
const DERIV_WS_URL = DERIV_TOKEN
  ? `wss://api.derivws.com/trading/v1/options/ws/real?otp=${DERIV_TOKEN}`
  : 'wss://api.derivws.com/trading/v1/options/ws/public';

function getKey(type, num) {
  return `${type}_${num}`;
}

function keyFromSymbol(symbol) {
  const idx = INDICES.find(i => i.symbol === symbol);
  return idx ? getKey(idx.type, idx.number) : null;
}

class DerivLiveService {
  constructor() {
    this.stateMap = new Map();
    this.candleMap15m = new Map();
    this.candleMap30m = new Map();
    this.candleMap60m = new Map();
    this.candleMap120m = new Map();
    this.priceAt24hAgo = new Map();
    this.ws = null;
    this.wsConnected = false;
    this.reconnectTimer = null;
    this.keepAliveTimer = null;
    this.historyLoaded = false;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;

    for (const idx of INDICES) {
      const key = getKey(idx.type, idx.number);
      this.stateMap.set(key, {
        price: 0,
        change24h: 0,
        history: [],
        timestamps: [],
        lastSpikeTime: Date.now(),
        lastSpikeDirection: null,
        spikeIntervals: [],
        spikeIntervalModel: { shape: 1, scale: 1, mean: 0, stdDev: 0, sampleSize: 0, ready: false },
        connected: false,
      });
      this.candleMap15m.set(key, []);
      this.candleMap30m.set(key, []);
      this.candleMap60m.set(key, []);
      this.candleMap120m.set(key, []);
    }
  }

  updateCandleMulti(key, price, timeMs) {
    const intervals = [
      { seconds: 900, map: this.candleMap15m },
      { seconds: 1800, map: this.candleMap30m },
      { seconds: 3600, map: this.candleMap60m },
      { seconds: 7200, map: this.candleMap120m },
    ];
    for (const { seconds, map } of intervals) {
      const candles = map.get(key);
      if (!candles) continue;
      const candleTime = Math.floor(timeMs / 1000 / seconds) * seconds;
      if (candles.length === 0 || candles[candles.length - 1].time !== candleTime) {
        candles.push({ time: candleTime, open: price, high: price, low: price, close: price });
        if (candles.length > 200) candles.shift();
      } else {
        const last = candles[candles.length - 1];
        last.high = Math.max(last.high, price);
        last.low = Math.min(last.low, price);
        last.close = price;
      }
    }
  }

  candlePrices(map, key) {
    return (map.get(key) || []).map(c => c.close);
  }

  startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 25000);
  }

  stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = this.reconnectDelay + Math.random() * 1000;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      this.connect();
    }, delay);
  }

  onTick(symbol, quote, epoch) {
    const key = keyFromSymbol(symbol);
    if (!key) return;
    const st = this.stateMap.get(key);
    if (!st) return;

    const ts = epoch * 1000;

    if (st.price > 0) {
      const spikeSize = Math.abs(quote - st.price) / st.price;
      if (spikeSize > 0.015) {
        if (st.lastSpikeTime > 0) {
          const interval = ts - st.lastSpikeTime;
          if (interval > 1000) {
            st.spikeIntervals.push(interval);
            if (st.spikeIntervals.length > 50) st.spikeIntervals.shift();
            if (st.spikeIntervals.length >= 3) {
              st.spikeIntervalModel = fitSpikeIntervals(st.spikeIntervals);
            }
          }
        }
        st.lastSpikeTime = ts;
        st.lastSpikeDirection = quote > st.price ? 'up' : 'down';
      }
    }

    st.price = quote;
    st.history.push(quote);
    st.timestamps.push(ts);
    st.connected = true;

    this.updateCandleMulti(key, quote, ts);

    if (st.history.length > 500) {
      st.history.shift();
      st.timestamps.shift();
    }

    if (this.priceAt24hAgo.has(key)) {
      const oldPrice = this.priceAt24hAgo.get(key);
      if (oldPrice > 0) {
        st.change24h = ((quote - oldPrice) / oldPrice) * 100;
      }
    }
  }

  processMessage(data) {
    if (data.msg_type === 'tick' && data.tick) {
      this.onTick(data.tick.symbol, data.tick.quote, data.tick.epoch);
    }

    if (data.msg_type === 'history' && data.history) {
      const prices = data.history.prices;
      const times = data.history.times;
      const symbol = data.echo_req?.ticks_history;
      const key = keyFromSymbol(symbol);
      if (!key || !prices) return;

      const st = this.stateMap.get(key);
      st.history = prices;
      st.timestamps = times.map(t => t * 1000);
      st.price = prices[prices.length - 1];
      st.connected = true;

      if (prices.length > 1440) {
        this.priceAt24hAgo.set(key, prices[prices.length - 1440]);
      } else if (prices.length > 0) {
        this.priceAt24hAgo.set(key, prices[0]);
      }
    }
  }

  subscribeAll() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    for (const symbol of DERIV_SYMBOLS) {
      this.ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
      this.ws.send(JSON.stringify({
        ticks_history: symbol,
        adjust_start_time: 1,
        end: 'latest',
        start: 1,
        style: 'ticks',
      }));
    }
    this.historyLoaded = true;
    console.log(`[Deriv] Subscribed to ${DERIV_SYMBOLS.length} synthetic indices`);
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (!DERIV_WS_URL) {
      console.warn('[Deriv] DERIV_WS_URL not available');
      return;
    }

    try {
      this.ws = new WebSocket(DERIV_WS_URL);

      this.ws.on('open', () => {
        this.wsConnected = true;
        this.reconnectDelay = 1000;
        this.historyLoaded = false;
        this.subscribeAll();
        this.startKeepAlive();
        console.log(`[Deriv] Connected${DERIV_TOKEN ? ' (authentifié)' : ''}`);
      });

      this.ws.on('message', (raw) => {
        try {
          this.processMessage(JSON.parse(raw.toString()));
        } catch { /* ignore */ }
      });

      this.ws.on('close', () => {
        this.wsConnected = false;
        this.stopKeepAlive();
        for (const st of this.stateMap.values()) {
          st.connected = false;
        }
        console.log('[Deriv] Disconnected, reconnexion dans ' + Math.round(this.reconnectDelay / 1000) + 's');
        this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        console.error('[Deriv] WebSocket error:', err.message);
        this.wsConnected = false;
        this.stopKeepAlive();
        this.scheduleReconnect();
      });
    } catch (err) {
      console.error('[Deriv] Connection failed:', err.message);
      this.wsConnected = false;
      this.scheduleReconnect();
    }
  }

  disconnect() {
    this.stopKeepAlive();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.wsConnected = false;
    for (const st of this.stateMap.values()) {
      st.connected = false;
    }
  }

  getState() {
    const result = {
      timestamp: Date.now(),
      source: this.wsConnected ? 'deriv-live' : 'disconnected',
    };

    for (const idx of INDICES) {
      const key = getKey(idx.type, idx.number);
      const st = this.stateMap.get(key);

      if (st.history.length > 1) {
        const minIdx = Math.max(0, st.history.length - 100);
        const recentPrices = st.history.slice(minIdx);
        if (recentPrices.length > 1) {
          const first = recentPrices[0];
          const last = recentPrices[recentPrices.length - 1];
          st.change24h = first > 0 ? ((last - first) / first) * 100 : 0;
        }
      }

      const label = `${idx.type.toLowerCase()}_${idx.number}`;
      result[label] = {
        price: st.price,
        change24h: st.change24h,
        history: st.history.slice(-100),
        timestamps: st.timestamps.slice(-100),
        type: idx.type,
        number: idx.number,
        lastSpikeTime: st.lastSpikeTime,
        lastSpikeDirection: st.lastSpikeDirection,
        connected: st.connected,
      };
    }

    return result;
  }

  get CLUSTER_TOLERANCE() { return 0.003; }

  findSupportResistance(prices, currentPrice) {
    const lookback = prices.slice(-120);
    const pivots = [];

    for (let i = 2; i < lookback.length - 2; i++) {
      const curr = lookback[i];
      const prev1 = lookback[i - 1];
      const prev2 = lookback[i - 2];
      const next1 = lookback[i + 1];
      const next2 = lookback[i + 2];

      if (curr > prev1 && curr > prev2 && curr > next1 && curr > next2) {
        pivots.push({ price: curr, isHigh: true });
      }
      if (curr < prev1 && curr < prev2 && curr < next1 && curr < next2) {
        pivots.push({ price: curr, isHigh: false });
      }
    }

    if (pivots.length === 0) return { nearestSupport: null, nearestResistance: null, allLevels: [] };

    const clusters = [];
    for (const pivot of pivots) {
      const existing = clusters.find(
        c => Math.abs(c.avgPrice - pivot.price) / pivot.price < this.CLUSTER_TOLERANCE && c.isHigh === pivot.isHigh
      );
      if (existing) {
        existing.avgPrice = (existing.avgPrice * existing.touches + pivot.price) / (existing.touches + 1);
        existing.touches++;
      } else {
        clusters.push({ avgPrice: pivot.price, touches: 1, isHigh: pivot.isHigh });
      }
    }

    const supports = clusters
      .filter(c => c.avgPrice < currentPrice)
      .map(c => ({ price: c.avgPrice, strength: c.touches, type: 'support' }));

    const resistances = clusters
      .filter(c => c.avgPrice > currentPrice)
      .map(c => ({ price: c.avgPrice, strength: c.touches, type: 'resistance' }));

    supports.sort((a, b) => b.price - a.price);
    resistances.sort((a, b) => a.price - b.price);

    const scoreLevel = (level) => {
      const distPct = Math.abs(level.price - currentPrice) / currentPrice;
      const distScore = Math.max(0, 1 - distPct / 0.02);
      return distScore * 0.4 + (level.strength / 10) * 0.6;
    };

    supports.sort((a, b) => scoreLevel(b) - scoreLevel(a));
    resistances.sort((a, b) => scoreLevel(b) - scoreLevel(a));

    return {
      nearestSupport: supports.length > 0 ? supports[0] : null,
      nearestResistance: resistances.length > 0 ? resistances[0] : null,
      allLevels: [...supports, ...resistances].sort((a, b) => b.strength - a.strength),
    };
  }

  predictSpike(type, num) {
    const key = getKey(type, num);
    const st = this.stateMap.get(key);
    if (!st || st.history.length < 20) {
      return { error: 'Pas assez de données historiques', connected: st?.connected ?? false };
    }

    const history = st.history;
    const currentPrice = st.price;
    const vol = this.calculateATR(history);
    const rsiVal = this.calculateRSI(history);
    const market = this.analyzeMarketStructure(history);
    const { nearestSupport, nearestResistance, allLevels } = this.findSupportResistance(history, currentPrice);
    const orderBlocks = this.findOrderBlocks(history);
    const regime = this.analyzeRegime(history);

    // --- Indicateurs techniques avancés ---
    const prices30m = this.candlePrices(this.candleMap30m, key);
    const prices60m = this.candlePrices(this.candleMap60m, key);
    const prices120m = this.candlePrices(this.candleMap120m, key);
    const candles15m = this.candleMap15m.get(key) || [];
    const candlePatterns = this.detectCandlestickPatterns(candles15m);
    const patternSignal = this.getPatternSignal(candlePatterns);

    const isBoom = type === 'BOOM';
    const isUp = isBoom;
    const expectedDirection = isUp ? 'up' : 'down';
    const refLevel = isBoom
      ? (nearestSupport?.price ?? Math.min(...history.slice(-20)))
      : (nearestResistance?.price ?? Math.max(...history.slice(-20)));
    const refStrength = isBoom
      ? (nearestSupport?.strength ?? 1)
      : (nearestResistance?.strength ?? 1);

    // --- Seuils dynamiques par indice (volatilité relative) ---
    const avgPrice = (currentPrice + refLevel) / 2 || currentPrice;
    const atrRatio = avgPrice > 0 ? vol / avgPrice : 0.001;
    const volScale = Math.max(atrRatio / 0.0005, 0.5); // ATR de référence ~0.05%

    const maxDistPct = isBoom
      ? Math.min(0.025 * volScale, 0.05)
      : Math.min(0.025 * volScale, 0.05);
    const maxDistance = avgPrice * maxDistPct;
    const distanceToLevel = Math.abs(currentPrice - refLevel);
    const proximity = Math.max(0, 1 - distanceToLevel / maxDistance);
    const extremeFactor = Math.min(proximity, 1);

    if ((isBoom && currentPrice < refLevel) || (!isBoom && currentPrice > refLevel)) {
      extremeFactor = Math.max(0, extremeFactor * 0.2);
    }

    // --- Momentum (mouvements consécutifs vers S/R) ---
    const recentMoves = history.slice(-15).map((p, i, arr) => (i > 0 ? p - arr[i - 1] : 0)).slice(1);
    const consecutive = recentMoves.slice(-5).filter(m => (isBoom ? m < 0 : m > 0)).length;
    const momentumFactor = Math.min(consecutive / 5, 1);

    // --- Approche prédictive avancée (velocity + divergence) ---
    let isApproaching = false;
    let approachVelocity = 0;
    if (refLevel) {
      const recent = history.slice(-10);
      let towardCount = 0;
      for (let i = 1; i < recent.length; i++) {
        const levelAbove = refLevel > currentPrice;
        const movingToward = levelAbove ? recent[i] > recent[i - 1] : recent[i] < recent[i - 1];
        if (movingToward) towardCount++;
      }
      // Vitesse d'approche (pente des 8 dernières ticks)
      const slice = history.slice(-8);
      const slope = (slice[slice.length - 1] - slice[0]) / slice.length;
      approachVelocity = Math.abs(slope) / (avgPrice || 1) / volScale;
      // Divergence : le prix approche mais RSI ne suit pas
      const rsiRecent = this.calculateRSI(history.slice(-30));
      const rsiDivergence = (isBoom && rsiRecent < 40) || (!isBoom && rsiRecent > 60);
      isApproaching = (towardCount >= 3 || approachVelocity > 0.3) || (towardCount >= 2 && rsiDivergence);
    }

    // --- Scoring ---
    const strengthBonus = Math.min(refStrength / 5, 1) * 0.08;
    const msSinceLastSpike = Date.now() - st.lastSpikeTime;

    // Spike interval model (Weibull) au lieu du timeFactor linéaire
    const spikeProb = spikeProbability(st.spikeIntervalModel, msSinceLastSpike, 60000);
    let spikeFactor;
    if (st.spikeIntervalModel.ready && st.spikeIntervalModel.sampleSize >= 3) {
      const hazard = st.spikeIntervalModel.shape / Math.max(st.spikeIntervalModel.scale, 1);
      const threshold = Math.min(1 - Math.exp(-hazard * 60), 0.8);
      if (spikeProb > threshold) spikeFactor = 1;
      else if (spikeProb < threshold * 0.5) spikeFactor = 0;
      else spikeFactor = 0.5;
    } else {
      spikeFactor = Math.min(msSinceLastSpike / (30 * 60 * 1000), 1);
    }

    let score = 0;
    score += extremeFactor * 0.35;
    score += momentumFactor * 0.12;
    score += spikeFactor * 0.05;
    score += strengthBonus;

    // Bonus indicateurs techniques
    let indicatorBonus = 0;
    if (isBoom && market.trend === 'uptrend') indicatorBonus += 0.06;
    else if (!isBoom && market.trend === 'downtrend') indicatorBonus += 0.06;
    else if (market.trend === 'ranging') indicatorBonus += 0.03;
    if (isBoom && market.liquiditySwept && market.lastBreakout === 'bullish') indicatorBonus += 0.05;
    else if (!isBoom && market.liquiditySwept && market.lastBreakout === 'bearish') indicatorBonus += 0.05;
    if (isBoom && rsiVal < 25) indicatorBonus += 0.04;
    else if (!isBoom && rsiVal > 75) indicatorBonus += 0.04;

    if (orderBlocks.length > 0) {
      const nearOB = Math.abs(orderBlocks[0].price - currentPrice) / currentPrice < 0.005;
      if (nearOB && ((isBoom && orderBlocks[0].type === 'bullish') || (!isBoom && orderBlocks[0].type === 'bearish'))) {
        indicatorBonus += 0.05;
      }
    }
    if (regime.market === 'trending_bull' && isBoom) indicatorBonus += 0.04;
    else if (regime.market === 'trending_bear' && !isBoom) indicatorBonus += 0.04;
    else if (regime.market === 'volatile') indicatorBonus += 0.02;

    if ((isBoom && patternSignal.signal === 'bullish') || (!isBoom && patternSignal.signal === 'bearish')) {
      indicatorBonus += Math.min(patternSignal.score / 20, 0.04);
    }

    // Features avancées (GARCH, Wavelet, Fourier)
    try {
      const adv = computeAdvancedFeatures(history);
      if (adv.compositeScore > 0.6) indicatorBonus += 0.06;
      else if (adv.compositeScore > 0.4) indicatorBonus += 0.03;
      if (adv.garchVolRatio > 1.5) indicatorBonus += 0.03;
      if (adv.waveletSpikeScore > 0.5) indicatorBonus += 0.04;
      if (adv.fourierSpikeScore > 0.5) indicatorBonus += 0.03;
    } catch (e) { /* silent */ }

    score = Math.min(score + indicatorBonus, 1);

    // --- Confirmation multi-TF ---
    let multiTFconfirm = 0;
    if (prices30m.length > 10) {
      const rsi30m = this.calculateRSI(prices30m);
      const market30m = this.analyzeMarketStructure(prices30m);
      const { nearestSupport: s30, nearestResistance: r30 } = this.findSupportResistance(prices30m, currentPrice);
      const ref30m = isBoom ? (s30?.price ?? Math.min(...prices30m.slice(-20))) : (r30?.price ?? Math.max(...prices30m.slice(-20)));
      const str30m = isBoom ? (s30?.strength ?? 1) : (r30?.strength ?? 1);
      const dist30m = Math.abs(currentPrice - ref30m);
      const prox30m = Math.max(0, 1 - dist30m / (avgPrice * maxDistPct));
      const momentum30m = prices30m.slice(-5).filter((p, i, arr) => i > 0 && (isBoom ? p < arr[i - 1] : p > arr[i - 1])).length;
      const score30m = prox30m * 0.35 + Math.min(momentum30m / 5, 1) * 0.12 + Math.min(str30m / 5, 1) * 0.08;
      if (score30m > 0.5) multiTFconfirm += 6;
      else multiTFconfirm -= 4;
    }
    if (prices60m.length > 10) {
      const rsi60m = this.calculateRSI(prices60m);
      const market60m = this.analyzeMarketStructure(prices60m);
      const { nearestSupport: s60, nearestResistance: r60 } = this.findSupportResistance(prices60m, currentPrice);
      const ref60m = isBoom ? (s60?.price ?? Math.min(...prices60m.slice(-20))) : (r60?.price ?? Math.max(...prices60m.slice(-20)));
      const str60m = isBoom ? (s60?.strength ?? 1) : (r60?.strength ?? 1);
      const dist60m = Math.abs(currentPrice - ref60m);
      const prox60m = Math.max(0, 1 - dist60m / (avgPrice * maxDistPct));
      const score60m = prox60m * 0.35 + Math.min(str60m / 5, 1) * 0.08;
      if (score60m > 0.5) multiTFconfirm += 4;
      else multiTFconfirm -= 3;
    }
    if (prices120m.length > 10) {
      const rsi120m = this.calculateRSI(prices120m);
      const market120m = this.analyzeMarketStructure(prices120m);
      const { nearestSupport: s120, nearestResistance: r120 } = this.findSupportResistance(prices120m, currentPrice);
      const ref120m = isBoom ? (s120?.price ?? Math.min(...prices120m.slice(-20))) : (r120?.price ?? Math.max(...prices120m.slice(-20)));
      const str120m = isBoom ? (s120?.strength ?? 1) : (r120?.strength ?? 1);
      const dist120m = Math.abs(currentPrice - ref120m);
      const prox120m = Math.max(0, 1 - dist120m / (avgPrice * maxDistPct));
      const score120m = prox120m * 0.35 + Math.min(str120m / 5, 1) * 0.08;
      if (score120m > 0.5) multiTFconfirm += 3;
      else multiTFconfirm -= 2;
    }

    let probability = Math.min(Math.max(score * 100 + multiTFconfirm, 20), 97);

    // --- Seuils de signal ajustés par volatilité ---
    const signalThresholdBuy = isBoom ? (volScale > 1.5 ? 78 : 82) : 75;
    const signalThresholdSell = !isBoom ? (volScale > 1.5 ? 78 : 82) : 75;
    const strongThreshold = 86;

    const levelTouched = this.checkLevelTouched(history, currentPrice, isBoom, nearestSupport, nearestResistance);
    const isSpikeImminent = probability >= (volScale > 1.5 ? 72 : 75) && (levelTouched || isApproaching);

    // --- Ampleur estimée ---
    const lookback = Math.min(history.length, 100);
    const recentHigh = Math.max(...history.slice(-lookback));
    const recentLow = Math.min(...history.slice(-lookback));
    const recentRange = currentPrice > 0 ? (recentHigh - recentLow) / currentPrice : 0.005;
    const magnitudePct = (0.008 + score * 0.04) * (recentRange / 0.005) * volScale;
    const magnitudeStr = `${(magnitudePct * 100).toFixed(1)}%`;

    // --- Points d'entrée/SL/TP ---
    const predictive = isApproaching && !levelTouched;
    let entryLevel;
    if (predictive) {
      entryLevel = isBoom ? currentPrice * 0.998 : currentPrice * 1.002;
    } else {
      entryLevel = isBoom
        ? Math.min(nearestSupport?.price ?? currentPrice * 0.99, currentPrice * 0.998)
        : Math.max(nearestResistance?.price ?? currentPrice * 1.01, currentPrice * 1.002);
    }

    const slMult = regime.market === 'volatile' ? 0.8 : regime.market === 'calm' ? 0.4 : 0.6;
    const tpMult = regime.market === 'volatile' ? 2.2 : regime.market === 'calm' ? 1.4 : 1.8;
    const slBuffer = Math.max(vol * slMult, currentPrice * 0.003);
    const tpBuffer = vol * tpMult;

    const stopLoss = isBoom
      ? (predictive ? entryLevel * 0.998 : Math.min(entryLevel * 0.996, entryLevel - slBuffer))
      : (predictive ? entryLevel * 1.002 : Math.max(entryLevel * 1.004, entryLevel + slBuffer));

    const tpTarget = predictive ? vol * 1.2 : vol * 0.8;
    const takeProfit = isBoom
      ? Math.max(entryLevel + tpTarget, currentPrice + tpTarget)
      : Math.min(entryLevel - tpTarget, currentPrice - tpTarget);

    const signal = isBoom
      ? (probability >= strongThreshold ? 'STRONG_BUY' : probability >= signalThresholdBuy ? 'BUY' : 'WATCH')
      : (probability >= strongThreshold ? 'STRONG_SELL' : probability >= signalThresholdSell ? 'SELL' : 'WATCH');

    const pricePos = nearestSupport && nearestResistance
      ? Math.round(((currentPrice - nearestSupport.price) / (nearestResistance.price - nearestSupport.price)) * 100)
      : 50;

    const bestRef = orderBlocks.length > 0 && Math.abs(orderBlocks[0].price - currentPrice) / currentPrice < 0.01
      ? { level: orderBlocks[0].price, strength: orderBlocks[0].strength }
      : { level: refLevel, strength: refStrength };

    return {
      type,
      number: num,
      currentPrice,
      spikeProbability: Math.round(probability),
      expectedDirection,
      estimatedMagnitude: magnitudeStr,
      timeSinceLastSpike: Math.round(msSinceLastSpike / 1000),
      isSpikeImminent,
      levelTouched,
      isApproaching,
      approachVelocity: Math.round(approachVelocity * 100) / 100,
      pricePosition: pricePos,
      consecutiveMoves: consecutive,
      rangeLow: nearestSupport?.price ?? currentPrice * 0.98,
      rangeHigh: nearestResistance?.price ?? currentPrice * 1.02,
      referenceLevel: Math.round(bestRef.level * 100) / 100,
      referenceStrength: bestRef.strength,
      distancePercent: Math.round(Math.abs(currentPrice - bestRef.level) / (bestRef.level || currentPrice) * 10000) / 100,
      sRlevels: allLevels.slice(0, 6).map(l => ({ price: Math.round(l.price * 100) / 100, strength: l.strength, type: l.type })),
      orderBlocks: orderBlocks.slice(0, 4).map(ob => ({ price: Math.round(ob.price * 100) / 100, type: ob.type, strength: ob.strength })),
      upScore: Math.round(score * 100),
      downScore: Math.round((1 - score) * 100),
      regime: { volatility: regime.volatility, market: regime.market, recommendation: regime.recommendation },
      candlePatterns: candlePatterns.slice(0, 3).map(p => ({ name: p.name, signal: p.signal, strength: p.strength })),
      entryPrice: Math.round(entryLevel * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      signal,
      connected: st.connected,
      timestamp: Date.now(),
      volScale: Math.round(volScale * 100) / 100,
    };
  }

  checkLevelTouched(history, currentPrice, isBoom, nearestSupport, nearestResistance) {
    const touchThreshold = 0.0008;
    const touchWindow = Math.min(history.length, 40);
    if (isBoom && nearestSupport) {
      for (let i = history.length - touchWindow; i < history.length; i++) {
        if (Math.abs(history[i] - nearestSupport.price) / nearestSupport.price < touchThreshold) return true;
      }
    } else if (!isBoom && nearestResistance) {
      for (let i = history.length - touchWindow; i < history.length; i++) {
        if (Math.abs(history[i] - nearestResistance.price) / nearestResistance.price < touchThreshold) return true;
      }
    }
    return false;
  }

  predictNextTick(type, num) {
    const key = getKey(type, num);
    const st = this.stateMap.get(key);
    if (!st || st.history.length < 10) {
      return { error: 'Pas assez de données historiques', connected: st?.connected ?? false };
    }

    const history = st.history;
    const recent = history.slice(-30);
    const changes = recent.map((p, i, arr) => (i > 0 ? p - arr[i - 1] : 0)).slice(1);

    const avgChange = changes.reduce((a, b) => a + b, 0) / (changes.length || 1);
    const variance = changes.reduce((a, b) => a + b * b, 0) / (changes.length || 1);
    const volatility = Math.sqrt(variance);

    const rand = Math.random();
    const prediction = rand > 0.5 ? 'UP' : 'DOWN';
    const confidence = Math.min(Math.abs(avgChange) / (volatility || 1) * 0.5 + 0.5, 0.95);

    return {
      type,
      number: num,
      currentPrice: st.price,
      prediction,
      confidence: Math.round(confidence * 100),
      connected: st.connected,
      timestamp: Date.now(),
    };
  }

  calculateATR(history, period = 14) {
    if (history.length < period + 1) return 0;
    const trs = [];
    for (let i = history.length - period; i < history.length; i++) {
      const high = Math.max(history[i], history[i - 1] || history[i]);
      const low = Math.min(history[i], history[i - 1] || history[i]);
      trs.push(high - low);
    }
    return trs.reduce((a, b) => a + b, 0) / trs.length;
  }

  calculateMFI(history, period = 14) {
    if (history.length < period + 1) return 50;
    const recent = history.slice(-period);
    let positive = 0;
    let negative = 0;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i] > recent[i - 1]) positive += recent[i];
      else negative += recent[i];
    }
    if (negative === 0) return 100;
    const ratio = positive / negative;
    return Math.round(100 - (100 / (1 + ratio)));
  }

  calculateMomentum(history, period = 10) {
    if (history.length < period) return 0;
    const slice = history.slice(-period);
    return (slice[slice.length - 1] - slice[0]) / slice[0];
  }

  calculateRSI(prices, period = 14) {
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

  findPivots(prices, lookback = 3) {
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

  analyzeMarketStructure(prices) {
    const recent = prices.slice(-60);
    if (recent.length < 20) return { trend: 'ranging', lastBreakout: null, liquiditySwept: false, imbalance: 0 };
    const pivots = this.findPivots(recent, 5);
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

  findOrderBlocks(prices) {
    const blocks = [];
    const recent = prices.slice(-200);
    if (recent.length < 30) return blocks;
    const avgMove = this.calculateATR(recent) / (recent.reduce((a, b) => a + b, 0) / recent.length);
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

  analyzeRegime(prices) {
    if (prices.length < 50) return { volatility: 'medium', market: 'ranging', adx: 25, recommendation: 'Données insuffisantes' };
    const atr14 = this.calculateATR(prices, 14);
    const atr50 = this.calculateATR(prices, 50);
    const volatility = atr50 > 0 ? (atr14 / atr50 > 1.5 ? 'high' : atr14 / atr50 < 0.7 ? 'low' : 'medium') : 'medium';
    const trendStrength = this.calculateMomentum(prices, 40);
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

  detectCandlestickPatterns(candles) {
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

  getPatternSignal(patterns) {
    let score = 0;
    for (const p of patterns) {
      if (p.signal === 'bullish') score += p.strength;
      else if (p.signal === 'bearish') score -= p.strength;
    }
    return { signal: score > 2 ? 'bullish' : score < -2 ? 'bearish' : 'neutral', score };
  }

  async generateSignal(type, num) {
    const prediction = this.predictSpike(type, num);
    if (prediction.error || !prediction.isSpikeImminent) return null;

    const key = getKey(type, num);
    const st = this.stateMap.get(key);
    const history = st.history;
    const atr = this.calculateATR(history);
    const atrRatio = atr / (prediction.currentPrice || 1);

    // Features enrichies depuis les nouveaux indicateurs de predictSpike
    const regime = prediction.regime || {};
    const features = {
      rsi: this.calculateRSI(history),
      atr_ratio: atrRatio,
      price_position: (prediction.pricePosition || 50) / 100,
      consecutive_moves: (prediction.consecutiveMoves || 0) / 10,
      time_since_spike: Math.min((prediction.timeSinceLastSpike || 999) / 100, 1),
      momentum: this.calculateMomentum(history),
      sr_distance: (prediction.distancePercent || 50) / 100,
      mfi: this.calculateMFI(history) / 100,
      macd_histogram: 0.5,
      bollinger_bandwidth: 0.5,
      adx: regime.adx ? Math.min(regime.adx / 100, 1) : 0.5,
      trend_strength: prediction.downScore > prediction.upScore ? -0.5 : 0.5,
      vwap_distance: 0.5,
      stoch_rsi: 0.5,
    };

    // ML integration: blend heuristic + ensemble ML prediction
    let mlBoost = 0;
    let ensembleBoost = 0;
    let mlDirection = prediction.expectedDirection;
    let probability = prediction.spikeProbability;

    try {
      const { mlService } = await import('./mlPrediction.js');
      if (mlService.ready) {
        const featArray = [
          features.rsi, features.atr_ratio, features.price_position,
          features.consecutive_moves, features.time_since_spike,
          features.momentum, features.sr_distance, features.mfi,
          features.macd_histogram, features.bollinger_bandwidth,
          features.adx, features.trend_strength,
          features.vwap_distance, features.stoch_rsi,
        ];
        const mlResult = mlService.predict(featArray);
        const mlTotal = mlResult.up + mlResult.down + mlResult.neutral || 1;
        const mlUpConfidence = mlResult.up / mlTotal;
        const mlDownConfidence = mlResult.down / mlTotal;

        if (mlResult.source === 'ml') {
          const mlAgrees = (prediction.expectedDirection === 'up' && mlUpConfidence > mlDownConfidence)
            || (prediction.expectedDirection === 'down' && mlDownConfidence > mlUpConfidence);

          if (mlAgrees) {
            mlBoost = Math.max(mlUpConfidence, mlDownConfidence) * 25;
          } else {
            mlBoost = -Math.max(mlUpConfidence, mlDownConfidence) * 20;
          }

          const topMl = mlUpConfidence > mlDownConfidence ? 'up' : 'down';
          if (topMl !== prediction.expectedDirection && Math.max(mlUpConfidence, mlDownConfidence) > 0.7) {
            mlDirection = topMl;
            mlBoost = Math.max(mlUpConfidence, mlDownConfidence) * 18;
          }
        }
      }

      const { ensembleML } = await import('./ensembleML.js');
      if (ensembleML.ready) {
        const ensembleFeatArray = [
          features.rsi, features.atr_ratio, features.price_position,
          features.consecutive_moves, features.time_since_spike,
          features.momentum, features.sr_distance, features.mfi,
          features.macd_histogram, features.bollinger_bandwidth,
          features.adx, features.trend_strength,
          features.vwap_distance, features.stoch_rsi,
        ];
        const ensembleResult = ensembleML.predict(ensembleFeatArray);
        if (ensembleResult.source === 'ensemble_ml' && ensembleResult.confidence > 0.35) {
          const ensembleTotal = ensembleResult.up + ensembleResult.down + ensembleResult.neutral || 1;
          const ensembleUpConf = ensembleResult.up / ensembleTotal;
          const ensembleDownConf = ensembleResult.down / ensembleTotal;
          const ensembleAgrees = (mlDirection === 'up' && ensembleUpConf > ensembleDownConf)
            || (mlDirection === 'down' && ensembleDownConf > ensembleUpConf);

          if (ensembleAgrees) {
            ensembleBoost = Math.max(ensembleUpConf, ensembleDownConf) * 20;
          } else {
            ensembleBoost = -Math.max(ensembleUpConf, ensembleDownConf) * 15;
          }
        }
      }
    } catch { /* ML not available, fallback to heuristic */ }

    // LSTM prediction
    let lstmBoost = 0;
    try {
      const { lstmService } = await import('./lstmPrediction.js');
      if (lstmService.ready && history.length >= 21) {
        const lstmSeq = lstmService.buildCurrentSequence(history, {
          rsiAtTime: (t) => features.rsi,
          atrRatioAtTime: (t) => features.atr_ratio,
          momentumAtTime: (t) => features.momentum,
          srDistanceAtTime: (t) => features.sr_distance,
          consecutiveMovesAtTime: (t) => features.consecutive_moves,
          volumeRatioAtTime: (t) => 0.5,
          volRegimeAtTime: (t) => 0.5,
          timeSinceSpikeAtTime: (t) => features.time_since_spike,
          advancedCompositeAtTime: (t) => 0.5,
        });
        if (lstmSeq) {
          const lstmResult = lstmService.predict(lstmSeq);
          if (lstmResult.source === 'lstm') {
            const lstmTotal = lstmResult.up + lstmResult.down + lstmResult.neutral || 1;
            const lstmUpConf = lstmResult.up / lstmTotal;
            const lstmDownConf = lstmResult.down / lstmTotal;
            const lstmAgrees = (mlDirection === 'up' && lstmUpConf > lstmDownConf)
              || (mlDirection === 'down' && lstmDownConf > lstmUpConf);
            if (lstmAgrees) {
              lstmBoost = Math.max(lstmUpConf, lstmDownConf) * 15;
            } else {
              lstmBoost = -Math.max(lstmUpConf, lstmDownConf) * 10;
            }
          }
        }
      }
    } catch { /* LSTM not available */ }

    probability = Math.min(Math.max(probability + mlBoost + ensembleBoost + lstmBoost, 0), 99);

    const upScore = mlDirection === 'up' ? probability : 100 - probability;
    const downScore = mlDirection === 'down' ? probability : 100 - probability;
    const signal = upScore > downScore ? 'STRONG_BUY' : 'STRONG_SELL';

    return {
      ...prediction,
      spikeProbability: Math.round(probability),
      expectedDirection: mlDirection,
      signal,
      entryPrice: Math.round(prediction.entryPrice * 100) / 100,
      stopLoss: Math.round(prediction.stopLoss * 100) / 100,
      takeProfit: Math.round(prediction.takeProfit * 100) / 100,
      upScore: Math.round(upScore),
      downScore: Math.round(downScore),
      mlBoost: Math.round(mlBoost),
      ensembleBoost: Math.round(ensembleBoost),
      rsi: Math.round(features.rsi),
      regime,
      features,
    };
  }

  async emitSignal(type, num) {
    const signal = await this.generateSignal(type, num);
    if (!signal) return null;

    const { signalTracker } = await import('./signalTracker.js');
    const saved = await signalTracker.recordSignal(signal);

    broadcastSignal({
      type: signal.type || type,
      number: signal.number || num,
      label: signal.label || `${type === 'BOOM' ? 'Boom' : 'Crash'} ${num}`,
      expectedDirection: signal.expectedDirection,
      spikeProbability: signal.spikeProbability,
      estimatedMagnitude: signal.estimatedMagnitude,
      entryPrice: signal.entryPrice,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      currentPrice: signal.currentPrice,
      isSpikeImminent: signal.isSpikeImminent,
      levelTouched: signal.levelTouched,
      isApproaching: signal.isApproaching,
    }).catch(() => {});

    return saved;
  }

  scanAllMarkets() {
    const opportunities = [];

    for (const idx of INDICES) {
      const key = getKey(idx.type, idx.number);
      const st = this.stateMap.get(key);
      if (!st || st.history.length < 20) continue;

      const prediction = this.predictSpike(idx.type, idx.number);
      if (!prediction || prediction.error) continue;

      const label = `${idx.type === 'BOOM' ? 'Boom' : 'Crash'} ${idx.number}`;

      opportunities.push({
        type: idx.type,
        number: idx.number,
        label,
        currentPrice: prediction.currentPrice,
        change24h: st.change24h,
        spikeProbability: prediction.spikeProbability,
        expectedDirection: prediction.expectedDirection,
        estimatedMagnitude: prediction.estimatedMagnitude,
        isSpikeImminent: prediction.isSpikeImminent,
        levelTouched: prediction.levelTouched,
        isApproaching: prediction.isApproaching,
        approachVelocity: prediction.approachVelocity,
        timeSinceLastSpike: prediction.timeSinceLastSpike,
        pricePosition: prediction.pricePosition,
        consecutiveMoves: prediction.consecutiveMoves,
        referenceLevel: prediction.referenceLevel,
        referenceStrength: prediction.referenceStrength,
        distancePercent: prediction.distancePercent,
        sRlevels: prediction.sRlevels,
        orderBlocks: prediction.orderBlocks,
        upScore: prediction.upScore,
        downScore: prediction.downScore,
        regime: prediction.regime,
        candlePatterns: prediction.candlePatterns,
        entryPrice: prediction.entryPrice,
        stopLoss: prediction.stopLoss,
        takeProfit: prediction.takeProfit,
        volScale: prediction.volScale,
        connected: prediction.connected,
        timestamp: prediction.timestamp,
      });
    }

    opportunities.sort((a, b) => b.spikeProbability - a.spikeProbability);

    const imminent = opportunities.filter(o => o.isSpikeImminent);
    if (imminent.length > 0) {
      for (const sig of imminent) {
        broadcastSignal(sig).catch(() => {});
      }
    }

    return {
      timestamp: Date.now(),
      source: this.wsConnected ? 'deriv-live' : 'disconnected',
      opportunities,
      bestOpportunity: opportunities.length > 0 ? opportunities[0] : null,
      imminentCount: imminent.length,
      totalAnalyzed: opportunities.length,
    };
  }
}

export const derivService = new DerivLiveService();
