"use client";

import { useState, useEffect, useCallback } from "react";
import type { EconomicEvent, NewsSignal } from "@/lib/newsData";

function ImpactBadge({ impact }: { impact: EconomicEvent["impact"] }) {
  const colors = {
    high: "bg-red-500/20 text-red-400 border-red-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${colors[impact]}`}>
      {impact}
    </span>
  );
}

function StatusBadge({ status }: { status: EconomicEvent["status"] }) {
  if (status === "live") return <span className="text-[10px] font-bold text-green-400 animate-pulse">● LIVE</span>;
  if (status === "done") return <span className="text-[10px] text-gray-500">✓ Fini</span>;
  return <span className="text-[10px] text-cyan-400">À venir</span>;
}

function SentimentBadge({ sentiment, confidence }: { sentiment: EconomicEvent["sentiment"]; confidence: number }) {
  if (!sentiment) return null;
  const colors = {
    bullish: "text-green-400",
    bearish: "text-red-400",
    neutral: "text-gray-400",
  };
  return <span className={`text-xs font-bold ${colors[sentiment]}`}>{sentiment === "bullish" ? "📈 " : sentiment === "bearish" ? "📉 " : "➖ "}{confidence}%</span>;
}

function SignalCard({ signal }: { signal: NewsSignal }) {
  const dirColors = {
    up: "border-green-500/30 bg-green-500/5",
    down: "border-red-500/30 bg-red-500/5",
    null: "border-gray-700 bg-gray-900",
  };
  const dir = signal.direction || "null";

  return (
    <div className={`rounded-xl border p-4 ${dirColors[dir]}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-xs text-gray-400">{signal.event.country} · {signal.event.time}</span>
          <ImpactBadge impact={signal.event.impact} />
        </div>
        <StatusBadge status={signal.event.status} />
      </div>

      <h4 className="font-semibold text-sm mb-1">{signal.event.title}</h4>

      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div className="bg-gray-800/50 rounded p-1.5">
          <span className="text-gray-500">Prév.</span>
          <p className="font-mono font-bold">{signal.event.forecast}</p>
        </div>
        <div className="bg-gray-800/50 rounded p-1.5">
          <span className="text-gray-500">Préc.</span>
          <p className="font-mono">{signal.event.previous}</p>
        </div>
        <div className="bg-gray-800/50 rounded p-1.5">
          <span className="text-gray-500">Signal</span>
          <p className={`font-mono font-bold ${signal.direction === "up" ? "text-green-400" : signal.direction === "down" ? "text-red-400" : "text-gray-400"}`}>
            {signal.direction === "up" ? "HAUSSE" : signal.direction === "down" ? "BAISSE" : "NEUTRE"}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-gray-400">Probabilité</span>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${signal.probability > 70 ? "bg-green-500" : signal.probability > 50 ? "bg-yellow-500" : "bg-red-500"}`}
              style={{ width: `${signal.probability}%` }} />
          </div>
          <span className={`font-bold font-mono text-xs ${signal.probability > 70 ? "text-green-400" : signal.probability > 50 ? "text-yellow-400" : "text-red-400"}`}>
            {signal.probability}%
          </span>
        </div>
      </div>

      {/* Entry / SL / TP en prix réels */}
      <div className="grid grid-cols-4 gap-1 text-[10px] mb-2 bg-gray-900/60 rounded-lg p-2">
        <div className="text-center">
          <span className="text-gray-500 block">Paire</span>
          <span className="text-white font-mono font-bold">{signal.pair}</span>
        </div>
        <div className="text-center">
          <span className="text-gray-500 block">Entry</span>
          <span className="text-white font-mono font-bold">{signal.entry.toFixed(5)}</span>
        </div>
        <div className="text-center">
          <span className="text-gray-500 block">TP</span>
          <span className="text-green-400 font-mono font-bold">{signal.takeProfit.toFixed(5)}</span>
        </div>
        <div className="text-center">
          <span className="text-gray-500 block">SL</span>
          <span className="text-red-400 font-mono font-bold">{signal.stopLoss.toFixed(5)}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div className="bg-gray-800/30 rounded p-1.5 text-center">
          <span className="text-gray-500 block">TP1</span>
          <span className="text-green-400 font-mono font-bold">{signal.targets.tp1}</span>
        </div>
        <div className="bg-gray-800/30 rounded p-1.5 text-center">
          <span className="text-gray-500 block">TP2</span>
          <span className="text-cyan-400 font-mono font-bold">{signal.targets.tp2}</span>
        </div>
        <div className="bg-gray-800/30 rounded p-1.5 text-center">
          <span className="text-gray-500 block">SL</span>
          <span className="text-red-400 font-mono font-bold">{signal.targets.sl}</span>
        </div>
      </div>

      <p className="text-xs text-gray-500 italic">{signal.reasoning}</p>
    </div>
  );
}

export default function NewsTrader() {
  const [data, setData] = useState<{ events: EconomicEvent[]; signals: NewsSignal[]; marketContext: any } | null>(null);
  const [filter, setFilter] = useState<"all" | EconomicEvent["impact"]>("all");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/news");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // fallback silencieux
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 300000); // 5 min
    return () => clearInterval(interval);
  }, [fetchData]);

  if (!data) return null;

  const filtered = filter === "all" ? data.events : data.events.filter(e => e.impact === filter);
  const upcomingCount = data.events.filter(e => e.status === "upcoming").length;
  const highImpactCount = data.events.filter(e => e.impact === "high" && e.status === "upcoming").length;

  return (
    <section className="max-w-6xl mx-auto py-12 px-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">📰</span>
        <h2 className="text-3xl font-bold">News Trading</h2>
      </div>
      <p className="text-gray-400 mb-6">
        Anticipez les mouvements du marché avant les annonces économiques majeures.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-cyan-400">{upcomingCount}</p>
          <p className="text-xs text-gray-500">Annonces à venir</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{highImpactCount}</p>
          <p className="text-xs text-gray-500">Haut impact</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{data.signals.length}</p>
          <p className="text-xs text-gray-500">Signaux générés</p>
        </div>
      </div>

      {/* Signals */}
      <h3 className="text-lg font-semibold mb-3">Signaux recommandés</h3>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {data.signals.slice(0, 6).map((sig) => (
          <SignalCard key={sig.event.id} signal={sig} />
        ))}
      </div>

      {/* Full calendar */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Calendrier économique</h3>
        <div className="flex gap-2">
          {(["all", "high", "medium", "low"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${filter === f ? "bg-cyan-500 text-black" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>
              {f === "all" ? "Tous" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left py-3 px-2">Date</th>
              <th className="text-left py-3 px-2">Heure</th>
              <th className="text-left py-3 px-2">Événement</th>
              <th className="text-center py-3 px-2">Impact</th>
              <th className="text-right py-3 px-2">Précédent</th>
              <th className="text-right py-3 px-2">Prévision</th>
              <th className="text-right py-3 px-2">Réel</th>
              <th className="text-center py-3 px-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 20).map((ev) => {
              const isHigh = ev.impact === "high";
              return (
                <tr key={ev.id} className={`border-b border-gray-800/30 hover:bg-gray-900/50 transition ${isHigh ? "bg-red-500/5" : ""}`}>
                  <td className="py-2.5 px-2 text-xs text-gray-400">{ev.date}</td>
                  <td className="py-2.5 px-2 font-mono text-xs">{ev.time}</td>
                  <td className="py-2.5 px-2">
                    <span className="font-medium text-xs">{ev.title}</span>
                  </td>
                  <td className="py-2.5 px-2 text-center"><ImpactBadge impact={ev.impact} /></td>
                  <td className="py-2.5 px-2 text-right font-mono text-xs">{ev.previous}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-xs text-cyan-400">{ev.forecast}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-xs">
                    {ev.actual ? <span className={ev.sentiment === "bullish" ? "text-green-400" : ev.sentiment === "bearish" ? "text-red-400" : "text-gray-400"}>{ev.actual}</span> : "—"}
                  </td>
                  <td className="py-2.5 px-2 text-center"><StatusBadge status={ev.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sentiment récent */}
      {data.events.filter(e => e.status === "done" && e.sentiment).length > 0 && (
        <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-3">Derniers résultats</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.events.filter(e => e.status === "done" && e.sentiment).slice(0, 8).map((ev) => (
              <div key={ev.id} className="bg-gray-800/50 rounded-lg p-3 text-xs">
                <p className="text-gray-400 truncate">{ev.title.split("—")[1] || ev.title}</p>
                <p className="mt-1"><SentimentBadge sentiment={ev.sentiment} confidence={ev.confidence} /></p>
                <p className="text-gray-500 mt-0.5">Réel: {ev.actual} / Prév: {ev.forecast}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
