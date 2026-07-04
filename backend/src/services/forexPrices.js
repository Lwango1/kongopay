// Prix forex et XAU/USD (Gold) en temps réel depuis Deriv WebSocket
// Paires supportées : EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD, XAU/USD

import WebSocket from 'ws';

const FOREX_SYMBOLS = [
  'frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'frxUSDCHF',
  'frxAUDUSD', 'frxUSDCAD', 'frxNZDUSD', 'frxXAUUSD',
];

const DERIV_TOKEN = process.env.DERIV_TOKEN || '';
const DERIV_WS_URL = DERIV_TOKEN
  ? `wss://ws.derivws.com/websockets/v3?app_id=1089&l=EN&otp=${DERIV_TOKEN}`
  : 'wss://ws.derivws.com/websockets/v3?app_id=1089&l=EN';

class ForexPriceService {
  constructor() {
    this.prices = new Map();
    this.ws = null;
    this.connected = false;
    this.reconnectTimer = null;
    this.reconnectDelay = 2000;

    for (const sym of FOREX_SYMBOLS) {
      const fallback = sym === 'frxXAUUSD' ? 2320.00 : 0;
      this.prices.set(sym, { bid: fallback, ask: fallback, price: fallback, timestamp: 0 });
    }
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(DERIV_WS_URL);

      this.ws.on('open', () => {
        this.connected = true;
        this.reconnectDelay = 2000;

        for (const sym of FOREX_SYMBOLS) {
          this.ws.send(JSON.stringify({ ticks: sym, subscribe: 1 }));
        }
        console.log('[ForexPrices] Connecté, abonné à', FOREX_SYMBOLS.length, 'paires');
      });

      this.ws.on('message', (raw) => {
        try {
          const data = JSON.parse(raw.toString());
          if (data.msg_type === 'tick' && data.tick && this.prices.has(data.tick.symbol)) {
            const entry = this.prices.get(data.tick.symbol);
            entry.price = data.tick.quote;
            entry.timestamp = data.tick.epoch * 1000;
            entry.bid = data.tick.quote;
            entry.ask = data.tick.quote;
          }
          if (data.msg_type === 'proposal' && data.proposal) {
            const sym = data.echo_req?.symbol;
            if (sym && this.prices.has(sym)) {
              const entry = this.prices.get(sym);
              entry.bid = data.proposal.bid_price || entry.bid;
              entry.ask = data.proposal.offer_price || entry.ask;
              entry.price = (entry.bid + entry.ask) / 2;
            }
          }
        } catch {}
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.scheduleReconnect();
      });

      this.ws.on('error', () => {
        this.scheduleReconnect();
      });
    } catch (err) {
      console.error('[ForexPrices] Erreur connexion:', err.message);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
      this.connect();
    }, this.reconnectDelay);
  }

  getPrice(symbol) {
    const entry = this.prices.get(symbol);
    return entry?.price || 0;
  }

  getAllPrices() {
    const result = {};
    for (const [sym, entry] of this.prices) {
      const pair = sym.replace('frx', '').replace(/(\w{3})(\w{3})/, '$1/$2');
      result[pair] = {
        price: entry.price,
        bid: entry.bid,
        ask: entry.ask,
        timestamp: entry.timestamp,
        connected: this.connected,
      };
    }
    return result;
  }

  // Map currency pair (e.g. "EURUSD") to Deriv symbol
  priceForPair(pair) {
    const sym = `frx${pair}`;
    return this.getPrice(sym);
  }

  // Get price for an event's currency
  priceForCurrency(currency) {
    if (currency === 'USD') return this.priceForPair('EURUSD');
    return this.priceForPair(`${currency}USD`);
  }

  // Get XAUUSD (Gold) price
  getGoldPrice() {
    return this.getPrice('frxXAUUSD') || 2320.00;
  }
}

export const forexPrices = new ForexPriceService();
