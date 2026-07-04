import { db, admin } from '../config/firebase.js';

const SUBSCRIPTION_COLLECTION = 'subscriptions';

async function isFirebaseAdmin(uid) {
  try {
    const { auth } = await import('../config/firebase.js');
    const user = await auth.getUser(uid);
    const claims = user.customClaims || {};
    return !!claims.admin;
  } catch {
    return false;
  }
}

const PLANS = {
  free: {
    name: 'Gratuit',
    priceCdf: 0,
    signalsPerDay: 4,
    maxP2POffers: 2,
  },
  premium: {
    name: 'Premium',
    priceCdf: 7000,
    priceUsd: 2.7,
    signalsPerDay: -1,
    maxP2POffers: -1,
    durationDays: 30,
  },
};

export class SubscriptionService {
  async getStatus(userId) {
    const ref = db.collection(SUBSCRIPTION_COLLECTION).doc(userId);
    const doc = await ref.get();

    if (!doc.exists) {
      const data = {
        userId,
        plan: 'free',
        isPremium: false,
        premiumUntil: null,
        signalsUsedToday: 0,
        signalsResetAt: new Date().toISOString().split('T')[0],
        p2pOffersCreated: 0,
        p2pOffersResetAt: new Date().toISOString().split('T')[0],
        trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      await ref.set(data);
      return data;
    }

    const data = doc.data();
    if (data.isPremium && data.premiumUntil && new Date(data.premiumUntil) <= new Date()) {
      await ref.update({
        isPremium: false,
        plan: 'free',
        premiumUntil: null,
        updatedAt: new Date().toISOString(),
      });
      data.isPremium = false;
      data.plan = 'free';
    }

    return data;
  }

  async getPlans() {
    return {
      free: {
        ...PLANS.free,
        signalsPerDay: PLANS.free.signalsPerDay,
        maxP2POffers: PLANS.free.maxP2POffers,
      },
      premium: {
        ...PLANS.premium,
        signalsPerDay: PLANS.premium.signalsPerDay === -1 ? -1 : PLANS.premium.signalsPerDay,
        maxP2POffers: PLANS.premium.maxP2POffers === -1 ? -1 : PLANS.premium.maxP2POffers,
      },
    };
  }

  async canAccessSignal(userId) {
    const isAdmin = await isFirebaseAdmin(userId);
    if (isAdmin) return { allowed: true, plan: 'admin' };

    const status = await this.getStatus(userId);
    if (status.isPremium && status.premiumUntil && new Date(status.premiumUntil) > new Date()) {
      return { allowed: true, plan: 'premium' };
    }

    const today = new Date().toISOString().split('T')[0];

    if (status.signalsResetAt !== today) {
      await db.collection(SUBSCRIPTION_COLLECTION).doc(userId).update({
        signalsUsedToday: 1,
        signalsResetAt: today,
      });
      return { allowed: true, plan: 'free', remaining: PLANS.free.signalsPerDay - 1 };
    }

    if (status.signalsUsedToday < PLANS.free.signalsPerDay) {
      await db.collection(SUBSCRIPTION_COLLECTION).doc(userId).update({
        signalsUsedToday: admin.firestore.FieldValue.increment(1),
      });
      return { allowed: true, plan: 'free', remaining: PLANS.free.signalsPerDay - status.signalsUsedToday - 1 };
    }

    return { allowed: false, plan: 'free', reason: 'limit_reached', remaining: 0 };
  }

  async canCreateP2POffer(userId) {
    const isAdmin = await isFirebaseAdmin(userId);
    if (isAdmin) return { allowed: true, plan: 'admin' };

    const status = await this.getStatus(userId);
    if (status.isPremium && status.premiumUntil && new Date(status.premiumUntil) > new Date()) {
      return { allowed: true, plan: 'premium' };
    }

    const today = new Date().toISOString().split('T')[0];

    const offersSnapshot = await db.collection('p2p_offers')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .get();

    const activeOffers = offersSnapshot.docs.length;

    if (activeOffers >= PLANS.free.maxP2POffers) {
      return { allowed: false, plan: 'free', reason: 'limit_reached', max: PLANS.free.maxP2POffers, active: activeOffers };
    }

    return { allowed: true, plan: 'free', remaining: PLANS.free.maxP2POffers - activeOffers, active: activeOffers };
  }

  async subscribeWithWallet(userId) {
    const { walletService } = await import('./wallet.js');
    const status = await this.getStatus(userId);

    if (status.isPremium && status.premiumUntil && new Date(status.premiumUntil) > new Date()) {
      throw Object.assign(new Error('Vous êtes déjà abonné Premium'), { status: 400 });
    }

    await walletService.debitCdf(userId, PLANS.premium.priceCdf,
      `Abonnement Premium KongoPay (${PLANS.premium.durationDays} jours)`
    );

    const until = new Date();
    until.setDate(until.getDate() + PLANS.premium.durationDays);

    const ref = db.collection(SUBSCRIPTION_COLLECTION).doc(userId);
    await ref.update({
      plan: 'premium',
      isPremium: true,
      premiumUntil: until.toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return {
      message: `Abonnement Premium activé pour ${PLANS.premium.durationDays} jours`,
      premiumUntil: until.toISOString(),
      price: PLANS.premium.priceCdf,
    };
  }

  async setPremium(userId, days, adminId) {
    const ref = db.collection(SUBSCRIPTION_COLLECTION).doc(userId);
    const doc = await ref.get();

    const until = new Date();
    until.setDate(until.getDate() + days);

    if (doc.exists) {
      await ref.update({
        plan: 'premium',
        isPremium: true,
        premiumUntil: until.toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: adminId,
      });
    } else {
      await ref.set({
        userId,
        plan: 'premium',
        isPremium: true,
        premiumUntil: until.toISOString(),
        signalsUsedToday: 0,
        signalsResetAt: new Date().toISOString().split('T')[0],
        p2pOffersCreated: 0,
        p2pOffersResetAt: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedBy: adminId,
      });
    }

    return { message: `Premium activé pour ${days} jours`, until: until.toISOString() };
  }

  async getSignalUsage(userId) {
    const isAdmin = await isFirebaseAdmin(userId);
    if (isAdmin) return { used: 0, limit: -1, remaining: -1, plan: 'admin' };

    const status = await this.getStatus(userId);
    if (status.isPremium && status.premiumUntil && new Date(status.premiumUntil) > new Date()) {
      return { used: 0, limit: -1, remaining: -1, plan: 'premium' };
    }
    const today = new Date().toISOString().split('T')[0];
    const used = status.signalsResetAt === today ? status.signalsUsedToday : 0;
    return { used, limit: PLANS.free.signalsPerDay, remaining: Math.max(0, PLANS.free.signalsPerDay - used), plan: 'free' };
  }

  async getP2POfferUsage(userId) {
    const isAdmin = await isFirebaseAdmin(userId);
    if (isAdmin) return { active: 0, max: -1, remaining: -1, plan: 'admin' };

    const status = await this.getStatus(userId);
    if (status.isPremium && status.premiumUntil && new Date(status.premiumUntil) > new Date()) {
      return { active: 0, max: -1, remaining: -1, plan: 'premium' };
    }

    const offersSnapshot = await db.collection('p2p_offers')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .get();

    const active = offersSnapshot.docs.length;
    return { active, max: PLANS.free.maxP2POffers, remaining: Math.max(0, PLANS.free.maxP2POffers - active), plan: 'free' };
  }
}

export const subscriptionService = new SubscriptionService();
