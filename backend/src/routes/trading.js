import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { binanceService } from '../services/binance.js';
import { walletService } from '../services/wallet.js';
import { validateOrder } from '../utils/validators.js';

const router = Router();

router.get('/ticker', async (req, res, next) => {
  try {
    const symbol = (req.query.symbol || 'BTC/USDT').toUpperCase();
    const ticker = await binanceService.getTicker(symbol);
    res.json(ticker);
  } catch (err) {
    next(err);
  }
});

router.get('/orderbook', async (req, res, next) => {
  try {
    const symbol = (req.query.symbol || 'BTC/USDT').toUpperCase();
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const orderbook = await binanceService.getOrderBook(symbol, limit);
    res.json(orderbook);
  } catch (err) {
    next(err);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const symbol = (req.query.symbol || 'BTC/USDT').toUpperCase();
    const timeframe = req.query.timeframe || '1h';
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const candles = await binanceService.getHistoricalRates(symbol, timeframe, limit);
    res.json(candles);
  } catch (err) {
    next(err);
  }
});

router.post('/order', authenticate, validateOrder, async (req, res, next) => {
  try {
    const { symbol, type, side, amount, price } = req.body;
    const order = await binanceService.createOrder({
      symbol: symbol.toUpperCase(),
      type: type || 'market',
      side: side.toLowerCase(),
      amount,
      price,
    });
    await walletService.logTransaction({
      userId: req.user.uid,
      type: 'order',
      subType: `${side}_${type}`,
      symbol: order.symbol,
      amount,
      price: order.price,
      status: order.status,
      description: `${side.toUpperCase()} ${amount} ${symbol} à ${order.price || 'market'}`,
    });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

router.get('/orders', authenticate, async (req, res, next) => {
  try {
    const symbol = req.query.symbol?.toUpperCase() || null;
    const orders = await binanceService.getOpenOrders(symbol);
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

router.delete('/order/:id', authenticate, async (req, res, next) => {
  try {
    const symbol = req.query.symbol?.toUpperCase();
    await binanceService.cancelOrder(req.params.id, symbol);
    res.json({ message: 'Ordre annulé' });
  } catch (err) {
    next(err);
  }
});

router.get('/trades', authenticate, async (req, res, next) => {
  try {
    const symbol = req.query.symbol?.toUpperCase() || null;
    const trades = await binanceService.getMyTrades(symbol);
    res.json(trades);
  } catch (err) {
    next(err);
  }
});

export default router;
