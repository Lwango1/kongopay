import { Router } from 'express';
import { binanceLiveService } from '../services/binanceLive.js';

const router = Router();

router.get('/state', (req, res) => {
  res.json(binanceLiveService.getState());
});

router.get('/predict', (req, res) => {
  const symbol = (req.query.symbol || 'BTC/USDT').toUpperCase();
  const result = binanceLiveService.predict(symbol);
  res.json(result);
});

router.get('/scan', (req, res) => {
  const result = binanceLiveService.scanAll();
  res.json(result);
});

export default router;
