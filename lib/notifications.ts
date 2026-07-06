import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { auth } from "./firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

let messaging: ReturnType<typeof getMessaging> | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;

async function ensureMessaging() {
  if (messaging) return messaging;
  const { getApps, initializeApp } = await import("firebase/app");
  const app = getApps().length === 0
    ? initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
      })
    : getApps()[0];
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
