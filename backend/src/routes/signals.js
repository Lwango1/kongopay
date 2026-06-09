import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { signalTracker } from '../services/signalTracker.js';

const router = Router();

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await signalTracker.getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get('/recent', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const signals = await signalTracker.getRecentSignals(limit);
    res.json(signals);
  } catch (err) {
    next(err);
  }
});

router.get('/by-label/:label', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const signals = await signalTracker.getSignalsByLabel(req.params.label, limit);
    res.json(signals);
  } catch (err) {
    next(err);
  }
});

export default router;
