import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { p2pService } from '../services/p2p.js';
import { validateP2POffer } from '../utils/validators.js';

const router = Router();

router.get('/payment-details', async (req, res, next) => {
  try {
    const details = await p2pService.getAdminPaymentDetails();
    res.json(details);
  } catch (err) {
    next(err);
  }
});

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

router.post('/trades', authenticate, async (req, res, next) => {
  try {
    const { offerId, amount } = req.body;
    if (!offerId || !amount) return res.status(400).json({ error: 'offerId et amount requis' });
    const result = await p2pService.placeOrder({
      offerId,
      buyerId: req.user.uid,
      buyerName: req.user.name || req.user.email || 'Utilisateur',
      amount: parseFloat(amount),
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/trades', authenticate, async (req, res, next) => {
  try {
    const isAdmin = req.user.uid === process.env.P2P_ADMIN_UID;
    const trades = isAdmin ? await p2pService.getAllTrades() : await p2pService.getUserTrades(req.user.uid);
    res.json(trades);
  } catch (err) {
    next(err);
  }
});

router.get('/trades/:id', authenticate, async (req, res, next) => {
  try {
    const trade = await p2pService.getTrade(req.params.id);
    if (trade.buyerId !== req.user.uid && trade.sellerId !== req.user.uid) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    res.json(trade);
  } catch (err) {
    next(err);
  }
});

router.post('/trades/:id/messages', authenticate, async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Message requis' });
    const message = await p2pService.sendMessage(
      req.params.id,
      req.user.uid,
      req.user.name || req.user.email || 'Utilisateur',
      content.trim()
    );
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

router.get('/trades/:id/messages', authenticate, async (req, res, next) => {
  try {
    const trade = await p2pService.getTrade(req.params.id);
    if (trade.buyerId !== req.user.uid && trade.sellerId !== req.user.uid) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    const messages = await p2pService.getMessages(req.params.id);
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

router.post('/trades/:id/confirm-payment', authenticate, async (req, res, next) => {
  try {
    const { transactionId, paymentMethod } = req.body;
    if (!transactionId || !paymentMethod) {
      return res.status(400).json({ error: 'transactionId et paymentMethod requis' });
    }
    const result = await p2pService.confirmPayment(req.params.id, req.user.uid, transactionId, paymentMethod);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/trades/:id/release', authenticate, async (req, res, next) => {
  try {
    const result = await p2pService.releaseFunds(req.params.id, req.user.uid);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/trades/:id/cancel', authenticate, async (req, res, next) => {
  try {
    const result = await p2pService.cancelTrade(req.params.id, req.user.uid);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/chats', authenticate, async (req, res, next) => {
  try {
    const { offerId } = req.body;
    if (!offerId) return res.status(400).json({ error: 'offerId requis' });
    const chat = await p2pService.getOrCreateChat(
      offerId,
      req.user.uid,
      req.user.name || req.user.email || 'Utilisateur'
    );
    res.json(chat);
  } catch (err) {
    next(err);
  }
});

router.get('/chats', authenticate, async (req, res, next) => {
  try {
    const isAdmin = req.user.uid === process.env.P2P_ADMIN_UID;
    const chats = isAdmin
      ? await p2pService.getAdminChats(req.user.uid)
      : await p2pService.getUserChats(req.user.uid);
    res.json(chats);
  } catch (err) {
    next(err);
  }
});

router.get('/chats/:id', authenticate, async (req, res, next) => {
  try {
    const chat = await p2pService.getChat(req.params.id);
    res.json(chat);
  } catch (err) {
    next(err);
  }
});

router.get('/chats/:id/messages', authenticate, async (req, res, next) => {
  try {
    const messages = await p2pService.getChatMessages(req.params.id);
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

router.post('/chats/:id/messages', authenticate, async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Message requis' });
    const message = await p2pService.sendChatMessage(
      req.params.id,
      req.user.uid,
      req.user.name || req.user.email || 'Utilisateur',
      content.trim()
    );
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

router.post('/chats/:id/place-order', authenticate, async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount) return res.status(400).json({ error: 'Montant requis' });
    const result = await p2pService.placeOrderFromChat(
      req.params.id,
      req.user.uid,
      parseFloat(amount)
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
