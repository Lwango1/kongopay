import { db, admin } from '../config/firebase.js';

const TOKENS_COLLECTION = 'fcm_tokens';

export async function registerToken(userId, token) {
  const ref = db.collection(TOKENS_COLLECTION).doc(userId);
  await ref.set({
    userId,
    token,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function unregisterToken(userId) {
  await db.collection(TOKENS_COLLECTION).doc(userId).delete();
}

export async function sendSignalNotification(userId, signal) {
  try {
    const doc = await db.collection(TOKENS_COLLECTION).doc(userId).get();
    if (!doc.exists) return;

    const { token } = doc.data();

    if (signal.type === 'FOREX') {
      const dir = signal.expectedDirection === 'up' ? '📈 HAUSSE' : '📉 BAISSE';
      const title = `KongoPay — ${signal.pair}`;
      const body = `${dir} ${signal.signal} | ${signal.probability}% | Entry ${signal.entryPrice} | TP ${signal.takeProfit} | SL ${signal.stopLoss}`;
      await admin.messaging().send({
        token,
        notification: { title, body },
        data: {
          type: 'forex-signal',
          pair: signal.pair,
          expectedDirection: signal.expectedDirection,
          probability: String(signal.probability),
          signal: signal.signal,
          entryPrice: String(signal.entryPrice),
          stopLoss: String(signal.stopLoss),
          takeProfit: String(signal.takeProfit),
          currentPrice: String(signal.currentPrice),
          killzone: signal.killzone || '',
          estimatedMagnitude: signal.estimatedMagnitude || '',
          url: '/signaux',
        },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      });
      return;
    }

    const direction = signal.expectedDirection === 'up' ? 'HAUSSE' : 'BAISSE';
    const label = `${signal.type === 'BOOM' ? 'Boom' : 'Crash'} ${signal.number}`;

    await admin.messaging().send({
      token,
      notification: {
        title: `Signal ${label}`,
        body: `${direction} — Probabilité ${signal.spikeProbability}% | Ampleur: ${signal.estimatedMagnitude}`,
      },
      data: {
        type: 'signal',
        indexType: signal.type,
        indexNumber: String(signal.number),
        direction: signal.expectedDirection,
        probability: String(signal.spikeProbability),
        magnitude: signal.estimatedMagnitude,
        url: '/',
      },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
  } catch (err) {
    if (err.code === 'messaging/registration-token-not-registered') {
      await unregisterToken(userId);
    }
  }
}

export async function broadcastSignal(signal) {
  const snapshot = await db.collection(TOKENS_COLLECTION).get();
  const promises = snapshot.docs.map(doc => sendSignalNotification(doc.id, signal));
  await Promise.allSettled(promises);
}
