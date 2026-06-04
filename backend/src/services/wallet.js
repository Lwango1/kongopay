import { db, admin } from '../config/firebase.js';

const WALLETS_COLLECTION = 'wallets';
const TRANSACTIONS_COLLECTION = 'transactions';
const RATE_CDF_USD = 2600;

export class WalletService {
  async getOrCreateWallet(userId) {
    const ref = db.collection(WALLETS_COLLECTION).doc(userId);
    const doc = await ref.get();
    if (!doc.exists) {
      const wallet = {
        userId,
        balanceCdf: 0,
        balanceUsd: 0,
        cryptoBalances: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await ref.set(wallet);
      return wallet;
    }
    return doc.data();
  }

  async creditCdf(userId, amountCdf, description = '') {
    const wallet = await this.getOrCreateWallet(userId);
    const amountUsd = amountCdf / RATE_CDF_USD;

    await db.collection(WALLETS_COLLECTION).doc(userId).update({
      balanceCdf: admin.firestore.FieldValue.increment(amountCdf),
      balanceUsd: admin.firestore.FieldValue.increment(amountUsd),
      updatedAt: new Date().toISOString(),
    });

    await this.logTransaction({
      userId,
      type: 'credit',
      amountCdf,
      amountUsd,
      currency: 'CDF',
      status: 'completed',
      description,
    });

    return { balanceCdf: wallet.balanceCdf + amountCdf, balanceUsd: wallet.balanceUsd + amountUsd };
  }

  async debitCdf(userId, amountCdf, description = '') {
    const wallet = await this.getOrCreateWallet(userId);
    if (wallet.balanceCdf < amountCdf) {
      throw Object.assign(new Error('Solde insuffisant'), { status: 400 });
    }

    const amountUsd = amountCdf / RATE_CDF_USD;
    await db.collection(WALLETS_COLLECTION).doc(userId).update({
      balanceCdf: admin.firestore.FieldValue.increment(-amountCdf),
      balanceUsd: admin.firestore.FieldValue.increment(-amountUsd),
      updatedAt: new Date().toISOString(),
    });

    await this.logTransaction({
      userId,
      type: 'debit',
      amountCdf,
      amountUsd,
      currency: 'CDF',
      status: 'completed',
      description,
    });

    return { balanceCdf: wallet.balanceCdf - amountCdf, balanceUsd: wallet.balanceUsd - amountUsd };
  }

  async updateCryptoBalance(userId, crypto, amount) {
    const key = `cryptoBalances.${crypto}`;
    await db.collection(WALLETS_COLLECTION).doc(userId).update({
      [key]: admin.firestore.FieldValue.increment(amount),
      updatedAt: new Date().toISOString(),
    });
  }

  async logTransaction(data) {
    const ref = db.collection(TRANSACTIONS_COLLECTION).doc();
    await ref.set({ ...data, id: ref.id, timestamp: new Date().toISOString() });
    return ref.id;
  }

  async getTransactions(userId, limit = 50) {
    const snapshot = await db.collection(TRANSACTIONS_COLLECTION)
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(d => d.data());
  }
}

export const walletService = new WalletService();
