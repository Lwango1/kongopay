import { body, query, validationResult } from 'express-validator';

export function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Données invalides', details: errors.array() });
  }
  next();
}

export const validateRegister = [
  body('email').isEmail().withMessage('Email invalide'),
  body('password').isLength({ min: 6 }).withMessage('Mot de passe trop court (min 6)'),
  body('displayName').notEmpty().withMessage('Nom requis'),
  handleValidation,
];

export const validateOrder = [
  body('symbol').matches(/^[A-Z0-9/]{5,15}$/).withMessage('Symbole invalide'),
  body('side').isIn(['buy', 'sell']).withMessage('Side doit être buy ou sell'),
  body('amount').isFloat({ min: 0.0001 }).withMessage('Montant invalide'),
  handleValidation,
];

export const validateDeposit = [
  body('phoneNumber').matches(/^\+?\d{10,15}$/).withMessage('Numéro de téléphone invalide'),
  body('operator').isIn(['AIRTEL', 'ORANGE', 'MPESA']).withMessage('Opérateur invalide'),
  body('amountCdf').isInt({ min: 100 }).withMessage('Montant minimum 100 CDF'),
  handleValidation,
];

export const validateP2POffer = [
  body('type').isIn(['buy', 'sell']).withMessage('Type doit être buy ou sell'),
  body('crypto').isIn(['BTC', 'ETH', 'SOL', 'BNB', 'USDT']).withMessage('Crypto invalide'),
  body('fiatAmount').isFloat({ min: 1000 }).withMessage('Montant minimum 1 000 CDF'),
  body('pricePerUnit').isFloat({ min: 1 }).withMessage('Prix unitaire invalide'),
  body('paymentMethod').notEmpty().withMessage('Méthode de paiement requise'),
  body('whatsapp').optional({ values: 'falsy' }).matches(/^\+?\d{7,15}$/).withMessage('Numéro WhatsApp invalide'),
  body('telegram').optional({ values: 'falsy' }).isString().trim().isLength({ min: 3 }).withMessage('Pseudo Telegram invalide'),
  handleValidation,
];
