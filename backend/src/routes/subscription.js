import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { subscriptionService } from '../services/subscription.js';

const router = Router();

router.get('/status', authenticate, async (req, res, next) => {
  try {
    const status = await subscriptionService.getStatus(req.user.uid);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

router.get('/plans', async (req, res, next) => {
  try {
    const plans = await subscriptionService.getPlans();
    res.json(plans);
  } catch (err) {
    next(err);
  }
});

router.post('/subscribe', authenticate, async (req, res, next) => {
  try {
    const result = await subscriptionService.subscribeWithWallet(req.user.uid);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/signal-access', authenticate, async (req, res, next) => {
  try {
    const result = await subscriptionService.canAccessSignal(req.user.uid);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/signal-usage', authenticate, async (req, res, next) => {
  try {
    const usage = await subscriptionService.getSignalUsage(req.user.uid);
    res.json(usage);
  } catch (err) {
    next(err);
  }
});

router.get('/p2p-usage', authenticate, async (req, res, next) => {
  try {
    const usage = await subscriptionService.getP2POfferUsage(req.user.uid);
    res.json(usage);
  } catch (err) {
    next(err);
  }
});

router.get('/can-create-offer', authenticate, async (req, res, next) => {
  try {
    const result = await subscriptionService.canCreateP2POffer(req.user.uid);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/set-premium', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { userId, days } = req.body;
    const result = await subscriptionService.setPremium(userId, days || 30, req.user.uid);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
