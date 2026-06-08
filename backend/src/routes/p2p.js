import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { p2pService } from '../services/p2p.js';
import { validateP2POffer } from '../utils/validators.js';

const router = Router();

router.get('/offers', async (req, res, next) => {
  try {
    const { type, crypto } = req.query;
    const offers = await p2pService.getActiveOffers(type || null, crypto || null);
    res.json(offers);
  } catch (err) {
    next(err);
  }
});

router.post('/offers', authenticate, validateP2POffer, async (req, res, next) => {
  try {
    const offer = await p2pService.createOffer({ userId: req.user.uid, ...req.body });
    res.status(201).json(offer);
  } catch (err) {
    next(err);
  }
});

router.get('/my-offers', authenticate, async (req, res, next) => {
  try {
    const offers = await p2pService.getMyOffers(req.user.uid);
    res.json(offers);
  } catch (err) {
    next(err);
  }
});

router.delete('/offers/:id', authenticate, async (req, res, next) => {
  try {
    const result = await p2pService.cancelOffer(req.params.id, req.user.uid);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
