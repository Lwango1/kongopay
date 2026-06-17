import { Router } from 'express';
import { getEconomicCalendar, getNewsStats } from '../services/newsService.js';

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

export default router;
