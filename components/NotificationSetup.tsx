"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { registerFCMToken, requestNotificationPermission, onForegroundMessage } from "@/lib/notifications";
import { Bell, BellOff, X } from "lucide-react";

export default function NotificationSetup() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      setEnabled(true);
    }
  }, []);

  useEffect(() => {
    if (user && Notification.permission === "granted") {
      registerFCMToken();
    }
  }, [user]);

  useEffect(() => {
    onForegroundMessage((payload) => {
      const title = payload?.notification?.title || "KongoPay";
      const body = payload?.notification?.body || "";
      if (title && body && Notification.permission === "granted") {
        new Notification(title, { body, icon: "/icon.png" });
      }
    });
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    const granted = await requestNotificationPermission();
    if (granted) {
      setEnabled(true);
      await registerFCMToken();
    }
    setLoading(false);
  };

  if (dismissed || enabled || !user) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0">
            <Bell size={20} className="text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm mb-1">Notifications push</h4>
            <p className="text-xs text-gray-400 mb-3">
              Recevez les signaux de trading en temps réel, même lorsque KongoPay est fermé.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleEnable}
                disabled={loading}
                className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? "..." : "Activer"}
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-colors"
              >
                Plus tard
              </button>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} className="text-gray-500 hover:text-gray-300">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
