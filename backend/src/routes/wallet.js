import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { walletService } from '../services/wallet.js';

const router = Router();

router.get('/balance', authenticate, async (req, res, next) => {
  try {
    const wallet = await walletService.getOrCreateWallet(req.user.uid);
    res.json(wallet);
  } catch (err) {
    next(err);
  }
});

router.get('/transactions', authenticate, async (req, res, next) => {
  try {
    const txs = await walletService.getTransactions(req.user.uid, parseInt(req.query.limit) || 50);
    res.json(txs);
  } catch (err) {
    next(err);
  }
});

export default router;
