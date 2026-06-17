import { WebSocket } from 'ws';
import { binanceService } from './binance.js';
import { predictCrypto, calculateATR } from './analysis.js';

const CRYPTO_PAIRS = [
  { type: 'CRYPTO', symbol: 'BTC/USDT', label: 'Bitcoin', color: '#f7931a' },
  { type: 'CRYPTO', symbol: 'ETH/USDT', label: 'Ethereum', color: '#627eea' },
  { type: 'CRYPTO', symbol: 'SOL/USDT', label: 'Solana', color: '#9945ff' },
  { type: 'CRYPTO', symbol: 'BNB/USDT', label: 'BNB', color: '#f0b90b' },
  { type: 'CRYPTO', symbol: 'XRP/USDT', label: 'XRP', color: '#00aae4' },
];

function streamName(symbol) {
  return symbol.replace('/', '').toLowerCase() + '@ticker';
}

class BinanceLiveService {
  constructor() {
    this.stateMap = new Map();
    this.candleMap15m = new Map();
    this.candleMap30m = new Map();
    this.candleMap60m = new Map();
    this.candleMap120m = new Map();
    this.ws = null;
    this.wsConnected = false;
    this.reconnectTimer = null;
    this.keepAliveTimer = null;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.historyRequests = new Set();

    for (const pair of CRYPTO_PAIRS) {
      this.stateMap.set(pair.symbol, {
        price: 0,
        change24h: 0,
        high24h: 0,
        low24h: 0,
        volume24h: 0,
        history: [],
        timestamps: [],
        lastSpikeTime: Date.now(),
        lastSpikeDirection: null,
        connected: false,
      });
      this.candleMap15m.set(pair.symbol, []);
      this.candleMap30m.set(pair.symbol, []);
      this.candleMap60m.set(pair.symbol, []);
      this.candleMap120m.set(pair.symbol, []);
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

  async loadHistory(symbol) {
    if (this.historyRequests.has(symbol)) return;
    this.historyRequests.add(symbol);
    try {
      const ohlcv = await binanceService.getHistoricalRates(symbol, '1m', 200);
      const st = this.stateMap.get(symbol);
      if (!st || ohlcv.length === 0) return;
      st.history = ohlcv.map(c => c.close);
      st.timestamps = ohlcv.map(c => c.timestamp);
      st.price = st.history[st.history.length - 1];
      st.connected = true;
      for (const c of ohlcv) {
        this.updateCandleMulti(symbol, c.close, c.timestamp);
      }
    } catch (err) {
      console.error(`[BinanceLive] History load failed ${symbol}:`, err.message);
    } finally {
      this.historyRequests.delete(symbol);
    }
  }

  onTicker(symbol, data) {
    const st = this.stateMap.get(symbol);
    if (!st) return;

    const price = parseFloat(data.c);
    const change = parseFloat(data.P);
    const high = parseFloat(data.h);
    const low = parseFloat(data.l);
    const volume = parseFloat(data.v);
    const eventTime = data.E;

    if (st.price > 0) {
      const spikeSize = Math.abs(price - st.price) / st.price;
      if (spikeSize > 0.015) {
        st.lastSpikeTime = eventTime;
        st.lastSpikeDirection = price > st.price ? 'up' : 'down';
      }
    }

    st.price = price;
    st.change24h = change;
    st.high24h = high;
    st.low24h = low;
    st.volume24h = volume;
    st.history.push(price);
    st.timestamps.push(eventTime);
    st.connected = true;

    this.updateCandleMulti(symbol, price, eventTime);

    if (st.history.length > 500) {
      st.history.shift();
      st.timestamps.shift();
    }
  }

  processMessage(data) {
    if (data.stream && data.data) {
      const stream = data.stream;
      const pair = CRYPTO_PAIRS.find(p => streamName(p.symbol) === stream);
      if (pair) {
        this.onTicker(pair.symbol, data.data);
      }
    }
  }

  subscribeAll() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const streams = CRYPTO_PAIRS.map(p => streamName(p.symbol)).join('/');
    const msg = { method: 'SUBSCRIBE', params: CRYPTO_PAIRS.map(p => streamName(p.symbol)), id: 1 };
    this.ws.send(JSON.stringify(msg));
    console.log(`[BinanceLive] Subscribed to ${CRYPTO_PAIRS.length} crypto pairs`);
    // Load history for all pairs
    for (const pair of CRYPTO_PAIRS) {
      this.loadHistory(pair.symbol);
    }
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    try {
      this.ws = new WebSocket('wss://stream.binance.com:9443/ws');
      this.ws.on('open', () => {
        this.wsConnected = true;
        this.reconnectDelay = 1000;
        this.subscribeAll();
        console.log('[BinanceLive] Connected');
      });
      this.ws.on('message', (raw) => {
        try { this.processMessage(JSON.parse(raw.toString())); } catch { /* ignore */ }
      });
      this.ws.on('close', () => {
        this.wsConnected = false;
        for (const st of this.stateMap.values()) st.connected = false;
        console.log('[BinanceLive] Disconnected');
        this.scheduleReconnect();
      });
      this.ws.on('error', (err) => {
        console.error('[BinanceLive] WS error:', err.message);
        this.scheduleReconnect();
      });
    } catch (err) {
      console.error('[BinanceLive] Connection failed:', err.message);
      this.scheduleReconnect();
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

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.wsConnected = false;
    for (const st of this.stateMap.values()) st.connected = false;
  }

  getState() {
    const result = { timestamp: Date.now(), source: this.wsConnected ? 'binance-live' : 'disconnected' };
    for (const pair of CRYPTO_PAIRS) {
      const st = this.stateMap.get(pair.symbol);
      const label = pair.symbol.replace('/', '_').toLowerCase();
      result[label] = {
        price: st?.price ?? 0,
        change24h: st?.change24h ?? 0,
        high24h: st?.high24h ?? 0,
        low24h: st?.low24h ?? 0,
        volume24h: st?.volume24h ?? 0,
        history: st?.history?.slice(-100) ?? [],
        timestamps: st?.timestamps?.slice(-100) ?? [],
        type: 'CRYPTO',
        symbol: pair.symbol,
        label: pair.label,
        lastSpikeTime: st?.lastSpikeTime ?? Date.now(),
        lastSpikeDirection: st?.lastSpikeDirection ?? null,
        connected: st?.connected ?? false,
      };
    }
    return result;
  }

  predict(symbol) {
    const st = this.stateMap.get(symbol);
    if (!st || st.history.length < 30) {
      return { error: 'Pas assez de données historiques', connected: st?.connected ?? false };
    }
    return predictCrypto('CRYPTO', symbol, st.history, st.price, this.candleMap15m, this.candleMap30m, this.candleMap60m, this.candleMap120m, symbol, st.lastSpikeTime);
  }

  scanAll() {
    const opportunities = [];
    for (const pair of CRYPTO_PAIRS) {
      const prediction = this.predict(pair.symbol);
      if (!prediction || prediction.error) continue;
      opportunities.push({
        type: pair.type,
        symbol: pair.symbol,
        label: pair.label,
        currentPrice: prediction.currentPrice,
        change24h: this.stateMap.get(pair.symbol)?.change24h ?? 0,
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
        upScore: prediction.upScore,
        downScore: prediction.downScore,
        sRlevels: prediction.sRlevels,
        orderBlocks: prediction.orderBlocks,
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
    return {
      timestamp: Date.now(),
      source: this.wsConnected ? 'binance-live' : 'disconnected',
      opportunities,
      bestOpportunity: opportunities.length > 0 ? opportunities[0] : null,
      imminentCount: opportunities.filter(o => o.isSpikeImminent).length,
      totalAnalyzed: opportunities.length,
    };
  }
}

export const binanceLiveService = new BinanceLiveService();
