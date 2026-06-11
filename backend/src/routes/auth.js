import { Router } from 'express';
import { auth } from '../config/firebase.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { walletService } from '../services/wallet.js';
import { validateRegister } from '../utils/validators.js';

const router = Router();

router.post('/register', validateRegister, async (req, res, next) => {
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
  const claims = user.customClaims || {};
  res.json({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    phoneNumber: user.phoneNumber,
    isAdmin: !!claims.admin,
    createdAt: user.metadata.creationTime,
  });
});

router.post('/set-admin', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { targetUid } = req.body;
    await auth.setCustomUserClaims(targetUid, { admin: true });
    res.json({ message: 'Admin ajouté' });
  } catch (err) {
    next(err);
  }
});

export default router;
