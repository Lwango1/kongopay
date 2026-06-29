import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { auth } from "./firebase";

const firebaseConfig = {
  apiKey: "AIzaSyCgIZMG7n0feKatCNr_b1plf4tOzzKHnac",
  authDomain: "kongopay-19815.firebaseapp.com",
  projectId: "kongopay-19815",
  storageBucket: "kongopay-19815.firebasestorage.app",
  messagingSenderId: "1043431316190",
  appId: "1:1043431316190:web:ae101c7c8169516b39c04f",
};

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

let messaging: ReturnType<typeof getMessaging> | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;

async function ensureMessaging() {
  if (messaging) return messaging;
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  messaging = getMessaging(app);
  return messaging;
}

async function ensureSW() {
  if (swRegistration) return swRegistration;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await reg.update();
    swRegistration = reg;
    return reg;
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export async function getFCMToken(): Promise<string | null> {
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return null;

    const msg = await ensureMessaging();
    const sw = await ensureSW();
    if (!sw || !VAPID_KEY) return null;

    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: sw,
    });
    return token;
  } catch {
    return null;
  }
}

export async function registerFCMToken(): Promise<boolean> {
  try {
    const user = auth.currentUser;
    if (!user) return false;

    const token = await getFCMToken();
    if (!token) return false;

    const idToken = await user.getIdToken();
    const res = await fetch("/api/notifications/register-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ token, platform: "web" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function onForegroundMessage(callback: (payload: any) => void) {
  ensureMessaging().then((msg) => {
    if (msg) onMessage(msg, callback);
  });
}
