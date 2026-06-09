import { db, admin } from '../config/firebase.js';

const SUBSCRIPTION_COLLECTION = 'subscriptions';

const FREE_SIGNALS_PER_DAY = 3;

export class SubscriptionService {
  async getStatus(userId) {
    const ref = db.collection(SUBSCRIPTION_COLLECTION).doc(userId);
    const doc = await ref.get();

    if (!doc.exists) {
      const data = {
        userId,
        isPremium: false,
        premiumUntil: null,
        signalsUsedToday: 0,
        signalsResetAt: new Date().toISOString().split('T')[0],
        trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      await ref.set(data);
      return data;
    }

    return doc.data();
  }

  async canAccessSignal(userId) {
    const status = await this.getStatus(userId);
    if (status.isPremium && status.premiumUntil && new Date(status.premiumUntil) > new Date()) {
      return { allowed: true, reason: 'premium' };
    }

    const today = new Date().toISOString().split('T')[0];

    if (status.signalsResetAt !== today) {
      await db.collection(SUBSCRIPTION_COLLECTION).doc(userId).update({
        signalsUsedToday: 1,
        signalsResetAt: today,
      });
      return { allowed: true, reason: 'free', remaining: FREE_SIGNALS_PER_DAY - 1 };
    }

    if (status.signalsUsedToday < FREE_SIGNALS_PER_DAY) {
      await db.collection(SUBSCRIPTION_COLLECTION).doc(userId).update({
        signalsUsedToday: admin.firestore.FieldValue.increment(1),
      });
      return { allowed: true, reason: 'free', remaining: FREE_SIGNALS_PER_DAY - status.signalsUsedToday - 1 };
    }

    return { allowed: false, reason: 'limit_reached', remaining: 0 };
  }

  async setPremium(userId, days, adminId) {
    const ref = db.collection(SUBSCRIPTION_COLLECTION).doc(userId);
    const doc = await ref.get();

    const until = new Date();
    until.setDate(until.getDate() + days);

    if (doc.exists) {
      await ref.update({
        isPremium: true,
        premiumUntil: until.toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: adminId,
      });
    } else {
      await ref.set({
        userId,
        isPremium: true,
        premiumUntil: until.toISOString(),
        signalsUsedToday: 0,
        signalsResetAt: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedBy: adminId,
      });
    }

    return { message: `Premium activé pour ${days} jours`, until: until.toISOString() };
  }

  async getSignalUsage(userId) {
    const status = await this.getStatus(userId);
    const today = new Date().toISOString().split('T')[0];
    const used = status.signalsResetAt === today ? status.signalsUsedToday : 0;
    return { used, limit: FREE_SIGNALS_PER_DAY, remaining: Math.max(0, FREE_SIGNALS_PER_DAY - used) };
  }
}

export const subscriptionService = new SubscriptionService();
