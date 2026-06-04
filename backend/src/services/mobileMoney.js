import { db } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';

const RATE_CDF_USD = 2600;

const MOBILE_OPERATORS = {
  AIRTEL: { prefix: '099', countries: ['CD'] },
  ORANGE: { prefix: '089', countries: ['CD'] },
  MPESA: { prefix: '081', countries: ['CD'] },
};

export class MobileMoneyService {
  async initiateDeposit({ userId, phoneNumber, operator, amountCdf }) {
    const ref = uuidv4().slice(0, 8).toUpperCase();
    const refId = `KP-${ref}`;

    const deposit = {
      id: refId,
      userId,
      phoneNumber,
      operator,
      amountCdf,
      amountUsd: amountCdf / RATE_CDF_USD,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };

    await db.collection('mobile_deposits').doc(refId).set(deposit);

    return {
      reference: refId,
      amountCdf,
      amountUsd: deposit.amountUsd,
      recipientNumber: this.getRecipientNumber(operator),
      recipientName: 'KongoPay SARL',
      expiresIn: '30 minutes',
    };
  }

  async confirmDeposit(referenceId, smsCode) {
    const ref = db.collection('mobile_deposits').doc(referenceId);
    const doc = await ref.get();

    if (!doc.exists) throw Object.assign(new Error('Dépôt introuvable'), { status: 404 });
    if (doc.data().status !== 'pending') throw Object.assign(new Error('Dépôt déjà traité'), { status: 400 });

    await ref.update({
      smsCode,
      status: 'confirmed',
      confirmedAt: new Date().toISOString(),
    });

    return { status: 'confirmed', message: 'Dépôt confirmé, en attente de validation admin' };
  }

  async approveDeposit(referenceId, adminId) {
    const ref = db.collection('mobile_deposits').doc(referenceId);
    const doc = await ref.get();

    if (!doc.exists) throw Object.assign(new Error('Dépôt introuvable'), { status: 404 });

    const data = doc.data();
    await ref.update({
      status: 'completed',
      approvedBy: adminId,
      approvedAt: new Date().toISOString(),
    });

    const { walletService } = await import('./wallet.js');
    await walletService.creditCdf(data.userId, data.amountCdf, `Dépôt Mobile Money ${data.operator} (${referenceId})`);

    return { status: 'completed', message: 'Dépôt approuvé et crédité' };
  }

  async initiateWithdrawal({ userId, phoneNumber, operator, amountCdf }) {
    const { walletService } = await import('./wallet.js');
    const wallet = await walletService.getOrCreateWallet(userId);

    if (wallet.balanceCdf < amountCdf) {
      throw Object.assign(new Error('Solde insuffisant'), { status: 400 });
    }

    const ref = uuidv4().slice(0, 8).toUpperCase();
    const refId = `KPW-${ref}`;

    const withdrawal = {
      id: refId,
      userId,
      phoneNumber,
      operator,
      amountCdf,
      amountUsd: amountCdf / RATE_CDF_USD,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await db.collection('mobile_withdrawals').doc(refId).set(withdrawal);
    await walletService.debitCdf(userId, amountCdf, `Retrait Mobile Money ${operator} (${refId})`);

    return {
      reference: refId,
      amountCdf,
      amountUsd: withdrawal.amountUsd,
      status: 'pending',
      message: 'Retrait initié, traitement en cours',
    };
  }

  async getPendingDeposits() {
    const snapshot = await db.collection('mobile_deposits')
      .where('status', '==', 'confirmed')
      .orderBy('confirmedAt', 'asc')
      .get();
    return snapshot.docs.map(d => d.data());
  }

  getRecipientNumber(operator) {
    const map = { AIRTEL: '0996710821', ORANGE: '0896710821', MPESA: '0816710821' };
    return map[operator] || map.AIRTEL;
  }
}

export const mobileMoneyService = new MobileMoneyService();
