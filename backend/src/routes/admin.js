import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { db } from '../config/firebase.js';
import { mobileMoneyService } from '../services/mobileMoney.js';
import { walletService } from '../services/wallet.js';

const router = Router();

router.get('/pending-deposits', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const deposits = await mobileMoneyService.getPendingDeposits();
    res.json(deposits);
  } catch (err) {
    next(err);
  }
});

router.post('/approve-deposit/:reference', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await mobileMoneyService.approveDeposit(req.params.reference, req.user.uid);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/users', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const list = await db.collection('wallets').get();
    const users = list.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.get('/transactions', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const snapshot = await db.collection('transactions')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();
    const txs = snapshot.docs.map(d => d.data());
    res.json(txs);
  } catch (err) {
    next(err);
  }
});

export default router;
