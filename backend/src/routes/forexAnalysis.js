import { Router } from 'express';
import { forexAnalysis } from '../services/forexAnalysisService.js';

const router = Router();

router.get('/', (_, res) => {
  try {
    const data = forexAnalysis.scanAll();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, source: 'error' });
  }
});

export default router;
