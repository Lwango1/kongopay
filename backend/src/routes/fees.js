import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { feeService } from '../services/fees.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const fees = await feeService.getFees();
    res.json(fees);
  } catch (err) {
    next(err);
  }
});

router.put('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await feeService.updateFees(req.user.uid, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
