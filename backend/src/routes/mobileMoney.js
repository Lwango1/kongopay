import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { mobileMoneyService } from '../services/mobileMoney.js';
import { walletService } from '../services/wallet.js';

const router = Router();

router.post('/deposit/initiate', authenticate, async (req, res, next) => {
  try {
    const { phoneNumber, operator, amountCdf } = req.body;
    const result = await mobileMoneyService.initiateDeposit({
      userId: req.user.uid,
      phoneNumber,
      operator,
      amountCdf,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/deposit/confirm', authenticate, async (req, res, next) => {
  try {
    const { reference, smsCode } = req.body;
    const result = await mobileMoneyService.confirmDeposit(reference, smsCode);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/withdraw', authenticate, async (req, res, next) => {
  try {
    const { phoneNumber, operator, amountCdf } = req.body;
    const result = await mobileMoneyService.initiateWithdrawal({
      userId: req.user.uid,
      phoneNumber,
      operator,
      amountCdf,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
