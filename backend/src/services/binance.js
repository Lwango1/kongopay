import ccxt from 'ccxt';

class BinanceService {
  constructor() {
    this.exchange = new ccxt.binance({
      apiKey: process.env.BINANCE_API_KEY,
      secret: process.env.BINANCE_API_SECRET,
      enableRateLimit: true,
      options: {
        defaultType: 'spot',
        adjustForTimeDifference: true,
      },
    });

    if (process.env.BINANCE_TESTNET === 'true') {
      this.exchange.setSandboxMode(true);
    }
  }

  async getTicker(symbol = 'BTC/USDT') {
    const ticker = await this.exchange.fetchTicker(symbol);
    return {
      symbol: ticker.symbol,
      price: ticker.last,
      change24h: ticker.percentage,
      high24h: ticker.high,
      low24h: ticker.low,
      volume24h: ticker.baseVolume,
    };
  }

  async getOrderBook(symbol = 'BTC/USDT', limit = 20) {
    const orderbook = await this.exchange.fetchOrderBook(symbol, limit);
    return {
      bids: orderbook.bids.slice(0, limit),
      asks: orderbook.asks.slice(0, limit),
    };
  }

  async getBalances() {
    const balance = await this.exchange.fetchBalance();
    const nonZero = {};
    for (const [currency, amount] of Object.entries(balance.total)) {
      if (amount > 0) nonZero[currency] = amount;
    }
    return nonZero;
  }

  async createOrder({ symbol, type, side, amount, price }) {
    const order = await this.exchange.createOrder(symbol, type, side, amount, price);
    return {
      id: order.id,
      symbol: order.symbol,
      type: order.type,
      side: order.side,
      price: order.price,
      amount: order.amount,
      filled: order.filled,
      cost: order.cost,
      status: order.status,
      timestamp: order.timestamp,
    };
  }

  async getOpenOrders(symbol = null) {
    const orders = await this.exchange.fetchOpenOrders(symbol);
    return orders.map(o => ({
      id: o.id,
      symbol: o.symbol,
      type: o.type,
      side: o.side,
      price: o.price,
      amount: o.amount,
      filled: o.filled,
      remaining: o.remaining,
      status: o.status,
    }));
  }

  async cancelOrder(id, symbol) {
    return this.exchange.cancelOrder(id, symbol);
  }

  async getMyTrades(symbol = null) {
    const trades = await this.exchange.fetchMyTrades(symbol);
    return trades.map(t => ({
      id: t.id,
      order: t.order,
      symbol: t.symbol,
      side: t.side,
      price: t.price,
      amount: t.amount,
      cost: t.cost,
      fee: t.fee,
      timestamp: t.timestamp,
    }));
  }

  async getHistoricalRates(symbol = 'BTC/USDT', timeframe = '1h', limit = 100) {
    const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
    return ohlcv.map(candle => ({
      timestamp: candle[0],
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5],
    }));
  }
}

export const binanceService = new BinanceService();
