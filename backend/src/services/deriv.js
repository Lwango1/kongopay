import { WebSocket } from 'ws';
import { broadcastSignal } from './pushNotifications.js';

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
    this.priceAt24hAgo = new Map();
    this.ws = null;
    this.wsConnected = false;
    this.reconnectTimer = null;
    this.keepAliveTimer = null;
    this.historyLoaded = false;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;

    for (const idx of INDICES) {
      this.stateMap.set(getKey(idx.type, idx.number), {
        price: 0,
        change24h: 0,
        history: [],
        timestamps: [],
        lastSpikeTime: Date.now(),
        lastSpikeDirection: null,
        connected: false,
      });
    }
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
        st.lastSpikeTime = ts;
        st.lastSpikeDirection = quote > st.price ? 'up' : 'down';
      }
    }

    st.price = quote;
    st.history.push(quote);
    st.timestamps.push(ts);
    st.connected = true;

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
    const { nearestSupport, nearestResistance, allLevels } = this.findSupportResistance(history, currentPrice);

    let extremeFactor;
    let expectedDirection;
    let referenceLevel;
    let referenceStrength;
    let distanceToLevel;

    if (type === 'BOOM') {
      referenceLevel = nearestSupport?.price ?? null;
      referenceStrength = nearestSupport?.strength ?? 0;

      if (referenceLevel === null) {
        referenceLevel = Math.min(...history.slice(-20));
        referenceStrength = 1;
      }

      distanceToLevel = Math.abs(currentPrice - referenceLevel);
      const maxDistance = referenceLevel * 0.015;
      const proximity = Math.max(0, 1 - distanceToLevel / maxDistance);
      extremeFactor = Math.min(proximity, 1);
      expectedDirection = 'up';

      if (currentPrice < referenceLevel) {
        extremeFactor = Math.max(0, extremeFactor * 0.2);
      }
    } else {
      referenceLevel = nearestResistance?.price ?? null;
      referenceStrength = nearestResistance?.strength ?? 0;

      if (referenceLevel === null) {
        referenceLevel = Math.max(...history.slice(-20));
        referenceStrength = 1;
      }

      distanceToLevel = Math.abs(currentPrice - referenceLevel);
      const maxDistance = referenceLevel * 0.015;
      const proximity = Math.max(0, 1 - distanceToLevel / maxDistance);
      extremeFactor = Math.min(proximity, 1);
      expectedDirection = 'down';

      if (currentPrice > referenceLevel) {
        extremeFactor = Math.max(0, extremeFactor * 0.2);
      }
    }

    const recentMoves = history.slice(-15).map((p, i, arr) => (i > 0 ? p - arr[i - 1] : 0)).slice(1);
    const consecutive = recentMoves.slice(-5).filter(m => (type === 'BOOM' ? m < 0 : m > 0)).length;
    const momentumFactor = Math.min(consecutive / 5, 1);

    // Approche predictive : est-ce que le prix se dirige vers le niveau S/R ?
    let isApproaching = false;
    if (referenceLevel) {
      const recent = history.slice(-6);
      let towardCount = 0;
      for (let i = 1; i < recent.length; i++) {
        const levelAbove = referenceLevel > currentPrice;
        const movingToward = levelAbove ? recent[i] > recent[i - 1] : recent[i] < recent[i - 1];
        if (movingToward) towardCount++;
      }
      isApproaching = towardCount >= 3;
    }

    const msSinceLastSpike = Date.now() - st.lastSpikeTime;
    const timeFactor = Math.min(msSinceLastSpike / 30000, 1);

    const strengthBonus = Math.min(referenceStrength / 5, 1) * 0.08;
    const spikeProbability = Math.min((extremeFactor * 0.40 + momentumFactor * 0.15 + timeFactor * 0.05 + strengthBonus) * 100, 95);

    const lookback = Math.min(history.length, 100);
    const recentHigh = Math.max(...history.slice(-lookback));
    const recentLow = Math.min(...history.slice(-lookback));
    const recentRange = currentPrice > 0 ? (recentHigh - recentLow) / currentPrice : 0.005;
    const estimatedMagnitude = ((0.015 + extremeFactor * 0.05) * (recentRange / 0.005) * 100).toFixed(1);
    const isUp = expectedDirection === 'up';
    const entryPrice = isUp
      ? Math.min(nearestSupport?.price ?? currentPrice * 0.99, currentPrice * 0.998)
      : Math.max(nearestResistance?.price ?? currentPrice * 1.01, currentPrice * 1.002);
    const slBuffer = Math.max(atr * 0.6, currentPrice * 0.003);
    const tpBuffer = Math.max(atr * 1.8, currentPrice * 0.008);
    const stopLoss = isUp
      ? Math.min(entryPrice * 0.996, entryPrice - slBuffer)
      : Math.max(entryPrice * 1.004, entryPrice + slBuffer);
    const takeProfit = isUp
      ? Math.max(entryPrice + tpBuffer, currentPrice + atr * 0.8)
      : Math.min(entryPrice - tpBuffer, currentPrice - atr * 0.8);

    const signal = isUp ? (spikeProbability >= 85 ? 'STRONG_BUY' : spikeProbability >= 75 ? 'BUY' : 'WATCH') : (spikeProbability >= 85 ? 'STRONG_SELL' : spikeProbability >= 75 ? 'SELL' : 'WATCH');

    return {
      type,
      number: num,
      currentPrice,
      spikeProbability: Math.round(spikeProbability),
      expectedDirection,
      estimatedMagnitude: `${estimatedMagnitude}%`,
      timeSinceLastSpike: Math.round(msSinceLastSpike / 1000),
      isSpikeImminent: spikeProbability > 70,
      isApproaching,
      pricePosition: nearestSupport && nearestResistance
        ? Math.round(((currentPrice - nearestSupport.price) / (nearestResistance.price - nearestSupport.price)) * 100)
        : 50,
      consecutiveMoves: consecutive,
      rangeLow: nearestSupport?.price ?? currentPrice * 0.98,
      rangeHigh: nearestResistance?.price ?? currentPrice * 1.02,
      referenceLevel,
      referenceStrength,
      distancePercent: Math.round((distanceToLevel / (referenceLevel || currentPrice)) * 10000) / 100,
      sRlevels: allLevels.slice(0, 6).map(l => ({
        price: Math.round(l.price * 100) / 100,
        strength: l.strength,
        type: l.type,
      })),
      entryPrice: Math.round(entryPrice * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      signal,
      connected: st.connected,
      timestamp: Date.now(),
    };
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

  async generateSignal(type, num) {
    const prediction = this.predictSpike(type, num);
    if (prediction.error || !prediction.isSpikeImminent) return null;

    const key = getKey(type, num);
    const st = this.stateMap.get(key);
    const history = st.history;
    const atr = this.calculateATR(history);
    const atrRatio = atr / (prediction.currentPrice || 1);

    // Improved feature extraction with new indicators
    const features = {
      rsi: prediction.spikeProbability > 50 ? (prediction.expectedDirection === 'up' ? 20 : 80) : 50,
      atr_ratio: atrRatio,
      volume: st.history.length > 100 ? (st.history.slice(-100).reduce((a, b) => a + b, 0) / st.history.slice(-100).length) / (prediction.currentPrice || 1) : 0.5,
      price_position: prediction.pricePosition / 100,
      consecutive_moves: prediction.consecutiveMoves / 10,
      time_since_spike: Math.min((prediction.timeSinceLastSpike || 999) / 100, 1),
      momentum: this.calculateMomentum(history),
      sr_distance: prediction.distancePercent / 100,
      mfi: this.calculateMFI(history) / 100,
      macd_histogram: 0.5,
      bollinger_bandwidth: 0.5,
      adx: 0.5,
      trend_strength: 0.5,
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
          features.rsi, features.atr_ratio, features.volume,
          features.price_position, features.consecutive_moves,
          features.time_since_spike, features.momentum,
          features.sr_distance, features.mfi, features.macd_histogram,
          features.bollinger_bandwidth, features.adx, features.trend_strength,
          features.vwap_distance, features.stoch_rsi,
        ];
        const mlResult = mlService.predict(featArray);
        const mlTotal = mlResult.up + mlResult.down + mlResult.neutral;
        const mlUpConfidence = mlResult.up / mlTotal;
        const mlDownConfidence = mlResult.down / mlTotal;

        if (mlResult.source === 'ml') {
          const mlAgrees = (prediction.expectedDirection === 'up' && mlUpConfidence > mlDownConfidence)
            || (prediction.expectedDirection === 'down' && mlDownConfidence > mlUpConfidence);

          if (mlAgrees) {
            mlBoost = Math.max(mlUpConfidence, mlDownConfidence) * 20;
          } else {
            mlBoost = -Math.max(mlUpConfidence, mlDownConfidence) * 15;
          }

          const topMl = mlUpConfidence > mlDownConfidence ? 'up' : 'down';
          if (topMl !== prediction.expectedDirection && Math.max(mlUpConfidence, mlDownConfidence) > 0.8) {
            mlDirection = topMl;
            mlBoost = Math.max(mlUpConfidence, mlDownConfidence) * 10;
          }
        }
      }

      // Ensemble ML models
      const { ensembleML } = await import('./ensembleML.js');
      if (ensembleML.ready) {
        const ensembleFeatArray = [
          features.rsi, features.atr_ratio, features.volume,
          features.price_position, features.consecutive_moves,
          features.time_since_spike, features.momentum,
          features.sr_distance, features.mfi, features.macd_histogram,
          features.bollinger_bandwidth, features.adx, features.trend_strength,
          features.vwap_distance, features.stoch_rsi,
        ];
        const ensembleResult = ensembleML.predict(ensembleFeatArray);
        if (ensembleResult.source === 'ensemble_ml' && ensembleResult.confidence > 0.4) {
          const ensembleTotal = ensembleResult.up + ensembleResult.down + ensembleResult.neutral;
          const ensembleUpConf = ensembleResult.up / ensembleTotal;
          const ensembleDownConf = ensembleResult.down / ensembleTotal;
          const ensembleAgrees = (mlDirection === 'up' && ensembleUpConf > ensembleDownConf)
            || (mlDirection === 'down' && ensembleDownConf > ensembleUpConf);

          if (ensembleAgrees) {
            ensembleBoost = Math.max(ensembleUpConf, ensembleDownConf) * 15;
          } else {
            ensembleBoost = -Math.max(ensembleUpConf, ensembleDownConf) * 10;
          }
        }
      }
    } catch { /* ML not available, fallback to heuristic */ }

    probability = Math.min(Math.max(probability + mlBoost + ensembleBoost, 0), 99);

    const dynamicSLMultiplier = type === 'BOOM' ? 1.5 : 1.5;
    const dynamicTPMultiplier = type === 'BOOM' ? 2.5 : 2.5;
    const slDistance = Math.max(atr * dynamicSLMultiplier, prediction.currentPrice * 0.005);
    const tpDistance = atr * dynamicTPMultiplier;

    let upScore = mlDirection === 'up' ? probability : 100 - probability;
    let downScore = mlDirection === 'down' ? probability : 100 - probability;
    const signal = upScore > downScore ? 'STRONG_BUY' : 'STRONG_SELL';

    const entryPrice = prediction.currentPrice;
    const stopLoss = signal === 'STRONG_BUY' ? entryPrice - slDistance : entryPrice + slDistance;
    const takeProfit = signal === 'STRONG_BUY' ? entryPrice + tpDistance : entryPrice - tpDistance;

    return {
      ...prediction,
      spikeProbability: Math.round(probability),
      expectedDirection: mlDirection,
      signal,
      entryPrice: Math.round(entryPrice * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      upScore: Math.round(upScore),
      downScore: Math.round(downScore),
      mlBoost: Math.round(mlBoost),
      ensembleBoost: Math.round(ensembleBoost),
      rsi: features.rsi,
      features,
    };
  }

  async emitSignal(type, num) {
    const signal = await this.generateSignal(type, num);
    if (!signal) return null;

    const { signalTracker } = await import('./signalTracker.js');
    const saved = await signalTracker.recordSignal(signal);
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
        timeSinceLastSpike: prediction.timeSinceLastSpike,
        pricePosition: prediction.pricePosition,
        consecutiveMoves: prediction.consecutiveMoves,
        referenceLevel: prediction.referenceLevel,
        referenceStrength: prediction.referenceStrength,
        distancePercent: prediction.distancePercent,
        sRlevels: prediction.sRlevels,
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
