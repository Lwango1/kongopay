import { Router } from 'express';
import { getEconomicCalendar, getNewsStats } from '../services/newsService.js';
import { getActiveNewsTrades } from '../services/newsRiskBridge.js';

const router = Router();

router.get('/', async (_, res) => {
  try {
    const data = await getEconomicCalendar();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, source: 'error' });
  }
});

router.get('/stats', (_, res) => {
  res.json(getNewsStats());
});

router.get('/active-trades', (_, res) => {
  res.json({ trades: getActiveNewsTrades(), count: getActiveNewsTrades().length });
});

export default router;
