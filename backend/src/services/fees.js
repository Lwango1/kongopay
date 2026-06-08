import { db } from '../config/firebase.js';

const CONFIG_COLLECTION = 'config';

export class FeeService {
  async getFees() {
    const doc = await db.collection(CONFIG_COLLECTION).doc('fees').get();
    if (!doc.exists) {
      const defaults = {
        tradingMaker: 0.001, // 0.1%
        tradingTaker: 0.001, // 0.1%
        withdrawalCdf: 0.005, // 0.5%
        withdrawalCrypto: 0.001, // 0.1%
        deposit: 0,
        updatedAt: new Date().toISOString(),
      };
      await db.collection(CONFIG_COLLECTION).doc('fees').set(defaults);
      return defaults;
    }
    return doc.data();
  }

  async updateFees(adminId, updates) {
    const allowed = ['tradingMaker', 'tradingTaker', 'withdrawalCdf', 'withdrawalCrypto', 'deposit'];
    const valid = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowed.includes(key) && typeof value === 'number' && value >= 0) {
        valid[key] = value;
      }
    }
    valid.updatedAt = new Date().toISOString();
    valid.updatedBy = adminId;

    await db.collection(CONFIG_COLLECTION).doc('fees').update(valid);
    return { message: 'Frais mis à jour', fees: { ...(await this.getFees()), ...valid } };
  }

  calculateOrderFee(amount, price, isMaker) {
    const rate = isMaker ? 0.001 : 0.001;
    return amount * price * rate;
  }

  calculateWithdrawalFee(amount, isCrypto) {
    const rate = isCrypto ? 0.001 : 0.005;
    return amount * rate;
  }
}

export const feeService = new FeeService();
