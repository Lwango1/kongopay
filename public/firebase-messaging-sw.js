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
  const title = notification?.title || "KongoPay Signal";
  const body = notification?.body || "";
  const tag = data?.key || "signal";

  self.registration.showNotification(title, {
    body,
    icon: "/icon.png",
    badge: "/badge.png",
    tag,
    data: { url: data?.url || "/" },
    requireInteraction: true,
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
