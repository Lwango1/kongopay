"use client";

import { useEffect, useState } from "react";
import { Telegram, Bell, BellOff } from "lucide-react";

export default function TelegramAlert() {
  const [botInfo, setBotInfo] = useState<{ botUsername?: string; inviteUrl?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/telegram/subscribe")
      .then((r) => r.json())
      .then(setBotInfo)
      .catch(() => {});
  }, []);

  if (!botInfo?.inviteUrl) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(botInfo.inviteUrl || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#1e2a3a] border border-[#2a3a4a] rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-[#0088cc]/20 flex items-center justify-center shrink-0">
        <Telegram size={20} className="text-[#0088cc]" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-white text-sm">Alertes Telegram</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Reçois les signaux spike en temps réel directement sur Telegram.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href={botInfo.inviteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0088cc] hover:bg-[#0077b5] text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Bell size={14} />
          S&apos;abonner
        </a>
        <button
          onClick={handleCopy}
          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
        >
          {copied ? "Copié !" : "Copier lien"}
        </button>
      </div>
    </div>
  );
}
