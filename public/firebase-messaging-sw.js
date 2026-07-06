importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCgIZMG7n0feKatCNr_b1plf4tOzzKHnac",
  authDomain: "kongopay-19815.firebaseapp.com",
  projectId: "kongopay-19815",
  storageBucket: "kongopay-19815.firebasestorage.app",
  messagingSenderId: "1043431316190",
  appId: "1:1043431316190:web:ae101c7c8169516b39c04f",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { notification, data } = payload;
  const title = notification?.title || data?.title || "KongoPay Signal";
  const body = notification?.body || data?.body || "";

  const direction = data?.expectedDirection === "up" ? "📈 HAUSSE" : data?.expectedDirection === "down" ? "📉 BAISSE" : "";
  const pair = data?.pair || "";
  const prob = data?.probability ? `${data.probability}%` : "";
  const signal = data?.signal || "";
  const reason = data?.reason || "";

  const notifBody = [pair, direction, signal, prob, reason, body].filter(Boolean).join(" · ");

  const tag = data?.key || data?.pair || "forex-signal";
  self.registration.showNotification(title || "KongoPay Signal Forex", {
    body: notifBody,
    icon: "/icon-192.svg",
    badge: "/icon-192.svg",
    tag,
    data: { url: data?.url || "/signaux" },
    requireInteraction: true,
    vibrate: [200, 100, 200],
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/signaux";
  event.waitUntil(clients.openWindow(url));
});
