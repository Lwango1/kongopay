import { Router } from 'express';
import { auth } from '../config/firebase.js';
import { authenticate } from '../middleware/auth.js';
import { walletService } from '../services/wallet.js';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, displayName } = req.body;
    const user = await auth.createUser({ email, password, displayName });
    await walletService.getOrCreateWallet(user.uid);
    res.status(201).json({ uid: user.uid, email: user.email });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res) => {
  const user = await auth.getUser(req.user.uid);
  res.json({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    phoneNumber: user.phoneNumber,
    createdAt: user.metadata.creationTime,
  });
});

router.post('/set-admin', authenticate, async (req, res, next) => {
  try {
    const { targetUid } = req.body;
    const caller = await auth.getUser(req.user.uid);
    if (caller.email !== 'lwangodany@gmail.com') {
      return res.status(403).json({ error: 'Seul le super admin peut définir des admins' });
    }
    await auth.setCustomUserClaims(targetUid, { admin: true });
    res.json({ message: 'Admin ajouté' });
  } catch (err) {
    next(err);
  }
});

export default router;
