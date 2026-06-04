import admin from 'firebase-admin';

let db = null;
let auth = null;

export function initializeFirebase() {
  if (admin.apps.length) return;

  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  db = admin.firestore();
  auth = admin.auth();

  console.log('Firebase initialized');
}

export { admin, db, auth };
