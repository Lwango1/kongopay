import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { kycService } from '../services/kyc.js';

const router = Router();

router.post('/submit', authenticate, async (req, res, next) => {
  try {
    const { fullName, dateOfBirth, nationality, idType, idNumber, address } = req.body;
    if (!fullName || !idType || !idNumber) {
      return res.status(400).json({ error: 'Nom, type et numéro de pièce requis' });
    }
    const result = await kycService.submitRequest({
      userId: req.user.uid,
      fullName,
      dateOfBirth,
      nationality: nationality || 'CD',
      idType,
      idNumber,
      address,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/status', authenticate, async (req, res, next) => {
  try {
    const status = await kycService.getStatus(req.user.uid);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

router.get('/pending', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const requests = await kycService.getPendingRequests();
    res.json(requests);
  } catch (err) {
    next(err);
  }
});

router.post('/approve/:userId', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await kycService.approveRequest(req.params.userId, req.user.uid);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/reject/:userId', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await kycService.rejectRequest(req.params.userId, req.user.uid, req.body.reason);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
