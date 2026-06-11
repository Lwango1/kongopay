import admin from 'firebase-admin';

let messaging: admin.messaging.Messaging | null = null;

try {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    }
    messaging = admin.messaging();
  }
} catch (e) {
  console.warn('[FirebaseAdmin] FCM non configuré, les push notifications sont désactivées');
}

export async function sendPush(token: string, title: string, body: string, data?: Record<string, string>) {
  if (!messaging) return;
  try {
    await messaging.send({
      token,
      notification: { title, body },
      data,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
  } catch (err: any) {
    if (err.code === 'messaging/registration-token-not-registered') {
      throw new Error('TOKEN_INVALID');
    }
  }
}

export async function sendPushToAll(tokens: string[], title: string, body: string, data?: Record<string, string>) {
  if (!messaging || tokens.length === 0) return;
  const promises = tokens.map(t => sendPush(t, title, body, data));
  await Promise.allSettled(promises);
}
