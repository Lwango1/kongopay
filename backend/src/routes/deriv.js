import { Router } from 'express';
import { derivService } from '../services/deriv.js';

const router = Router();

router.get('/state', (req, res) => {
  const data = derivService.getState();
  res.json(data);
});

router.get('/predict', (req, res) => {
  const type = (req.query.type || 'BOOM').toUpperCase();
  const num = parseInt(req.query.number) || 500;
  const data = derivService.predictNextTick(type, num);
  res.json(data);
});

router.get('/spike', (req, res) => {
  const type = (req.query.type || 'BOOM').toUpperCase();
  const num = parseInt(req.query.number) || 500;
  const prediction = derivService.predictSpike(type, num);
  const spikeHistory = { type, number: num, recentSpikes: [] };
  res.json({ prediction, history: spikeHistory });
});

export default router;
