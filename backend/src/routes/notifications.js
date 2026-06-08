import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { notificationService } from '../services/notifications.js';

const router = Router();

router.get('/alerts', authenticate, async (req, res, next) => {
  try {
    const alerts = await notificationService.getAlerts(req.user.uid);
    res.json(alerts);
  } catch (err) {
    next(err);
  }
});

router.post('/alerts', authenticate, async (req, res, next) => {
  try {
    const { pair, targetPrice, direction } = req.body;
    if (!pair || !targetPrice || !direction) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }
    const alert = await notificationService.createAlert({
      userId: req.user.uid,
      pair,
      targetPrice,
      direction,
    });
    res.status(201).json(alert);
  } catch (err) {
    next(err);
  }
});

router.delete('/alerts/:id', authenticate, async (req, res, next) => {
  try {
    const result = await notificationService.deleteAlert(req.params.id, req.user.uid);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
