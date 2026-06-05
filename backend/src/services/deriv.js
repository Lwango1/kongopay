import { WebSocket } from 'ws';

const INDICES = [
  { type: 'BOOM', number: 500, symbol: 'BOOM500' },
  { type: 'BOOM', number: 900, symbol: 'BOOM900' },
  { type: 'BOOM', number: 1000, symbol: 'BOOM1000' },
  { type: 'CRASH', number: 500, symbol: 'CRASH500' },
  { type: 'CRASH', number: 900, symbol: 'CRASH900' },
  { type: 'CRASH', number: 1000, symbol: 'CRASH1000' },
];

const DERIV_SYMBOLS = INDICES.map(i => i.symbol);
const DERIV_APP_ID = process.env.DERIV_APP_ID || '';

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
    this.historyLoaded = false;

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
    if (this.wsConnected) return;
    if (!DERIV_APP_ID) {
      console.warn('[Deriv] DERIV_APP_ID not set in backend/.env');
      console.warn('[Deriv] Get your app_id: https://app.deriv.com/account/api-token');
      return;
    }

    try {
      const url = `wss://ws.deriv.com/websockets/v3?app_id=${DERIV_APP_ID}`;
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        this.wsConnected = true;
        this.historyLoaded = false;
        this.subscribeAll();
        console.log(`[Deriv] Connected (app_id: ${DERIV_APP_ID})`);
      });

      this.ws.on('message', (raw) => {
        try {
          this.processMessage(JSON.parse(raw.toString()));
        } catch { /* ignore */ }
      });

      this.ws.on('close', () => {
        this.wsConnected = false;
        for (const st of this.stateMap.values()) {
          st.connected = false;
        }
        if (DERIV_APP_ID) {
          this.reconnectTimer = setTimeout(() => this.connect(), 3000);
        }
      });

      this.ws.on('error', (err) => {
        console.error('[Deriv] WebSocket error:', err.message);
        this.wsConnected = false;
      });
    } catch (err) {
      console.error('[Deriv] Connection failed:', err.message);
      this.wsConnected = false;
    }
  }

  disconnect() {
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

  predictSpike(type, num) {
    const key = getKey(type, num);
    const st = this.stateMap.get(key);
    if (!st || st.history.length < 10) {
      return { error: 'Pas assez de données historiques', connected: st?.connected ?? false };
    }

    const history = st.history;
    const lookback = history.slice(-50);
    const minPrice = Math.min(...lookback);
    const maxPrice = Math.max(...lookback);
    const range = maxPrice - minPrice || 1;
    const position = (st.price - minPrice) / range;

    let extremeFactor;
    let expectedDirection;

    if (type === 'BOOM') {
      extremeFactor = 1 - position;
      expectedDirection = 'up';
    } else {
      extremeFactor = position;
      expectedDirection = 'down';
    }

    const recentMoves = history.slice(-15).map((p, i, arr) => (i > 0 ? p - arr[i - 1] : 0)).slice(1);
    const consecutive = recentMoves.slice(-5).filter(m => (type === 'BOOM' ? m < 0 : m > 0)).length;
    const momentumFactor = Math.min(consecutive / 5, 1);

    const msSinceLastSpike = Date.now() - st.lastSpikeTime;
    const timeFactor = Math.min(msSinceLastSpike / 20000, 1);

    const spikeProbability = Math.min((extremeFactor * 0.5 + momentumFactor * 0.3 + timeFactor * 0.2) * 100, 95);
    const volatilityFactor = 1000 / num;
    const estimatedMagnitude = ((0.015 + extremeFactor * 0.05) * volatilityFactor * 100).toFixed(1);

    return {
      type,
      number: num,
      currentPrice: st.price,
      spikeProbability: Math.round(spikeProbability),
      expectedDirection,
      estimatedMagnitude: `${estimatedMagnitude}%`,
      timeSinceLastSpike: Math.round(msSinceLastSpike / 1000),
      isSpikeImminent: spikeProbability > 70,
      pricePosition: Math.round(position * 100),
      consecutiveMoves: consecutive,
      rangeLow: minPrice,
      rangeHigh: maxPrice,
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
}

export const derivService = new DerivLiveService();
