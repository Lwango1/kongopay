import { db } from '../config/firebase.js';

const ALERTS_COLLECTION = 'price_alerts';

export class NotificationService {
  async createAlert({ userId, pair, targetPrice, direction }) {
    const ref = db.collection(ALERTS_COLLECTION).doc();
    const alert = {
      id: ref.id,
      userId,
      pair: pair.toUpperCase(),
      targetPrice,
      direction, // 'above' | 'below'
      status: 'active',
      triggeredAt: null,
      createdAt: new Date().toISOString(),
    };
    await ref.set(alert);
    return alert;
  }

  async getAlerts(userId) {
    const snapshot = await db.collection(ALERTS_COLLECTION)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    return snapshot.docs.map(d => d.data());
  }

  async deleteAlert(alertId, userId) {
    const ref = db.collection(ALERTS_COLLECTION).doc(alertId);
    const doc = await ref.get();
    if (!doc.exists) throw Object.assign(new Error('Alerte introuvable'), { status: 404 });
    if (doc.data().userId !== userId) throw Object.assign(new Error('Non autorisé'), { status: 403 });
    await ref.delete();
    return { message: 'Alerte supprimée' };
  }

  // Called by a cron/interval to check alerts against current prices
  async checkAlerts(getPrice) {
    const snapshot = await db.collection(ALERTS_COLLECTION)
      .where('status', '==', 'active')
      .get();

    const triggered = [];
    for (const doc of snapshot.docs) {
      const alert = doc.data();
      try {
        const currentPrice = await getPrice(alert.pair);
        if (!currentPrice) continue;

        const shouldTrigger =
          (alert.direction === 'above' && currentPrice >= alert.targetPrice) ||
          (alert.direction === 'below' && currentPrice <= alert.targetPrice);

        if (shouldTrigger) {
          await doc.ref.update({ status: 'triggered', triggeredAt: new Date().toISOString() });
          triggered.push(alert);
        }
      } catch { /* skip on error */ }
    }
    return triggered;
  }
}

export const notificationService = new NotificationService();
