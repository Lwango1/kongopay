"use client";

import { useState, useEffect, useCallback } from "react";
import { Newspaper, TrendingUp, TrendingDown, AlertTriangle, Calendar, BarChart3, Loader2, RefreshCw } from "lucide-react";
import type { EconomicEvent, NewsSignal } from "@/lib/newsData";

function ImpactBadge({ impact }: { impact: EconomicEvent["impact"] }) {
  const colors = {
    high: "bg-danger/20 text-danger border-danger/30",
    medium: "bg-warning/20 text-warning border-warning/30",
    low: "bg-primary/20 text-primary border-primary/30",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${colors[impact]}`}>
      {impact}
    </span>
  );
}

function StatusBadge({ status }: { status: EconomicEvent["status"] }) {
  if (status === "live") return <span className="text-[10px] font-bold text-success animate-pulse">● EN DIRECT</span>;
  if (status === "done") return <span className="text-[10px] text-text-muted">✓ Terminé</span>;
  return <span className="text-[10px] text-primary">À venir</span>;
}

function SentimentBadge({ sentiment, confidence }: { sentiment: EconomicEvent["sentiment"]; confidence: number }) {
  if (!sentiment) return null;
  const colors = {
    bullish: "text-success",
    bearish: "text-danger",
    neutral: "text-text-muted",
  };
  return <span className={`text-xs font-bold ${colors[sentiment]}`}>{sentiment === "bullish" ? "📈 " : sentiment === "bearish" ? "📉 " : "➖ "}{confidence}%</span>;
}

function SignalCard({ signal }: { signal: NewsSignal }) {
  const dirColors = {
    up: "border-success/30 bg-success/5",
    down: "border-danger/30 bg-danger/5",
    null: "border-border bg-surface",
  };
  const dir = signal.direction || "null";

  return (
    <div className={`rounded-xl border p-4 ${dirColors[dir]}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">{signal.event.country} · {signal.event.time}</span>
          <ImpactBadge impact={signal.event.impact} />
        </div>
        <StatusBadge status={signal.event.status} />
      </div>

      <h4 className="font-semibold text-sm mb-1">{signal.event.title}</h4>

      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div className="bg-background rounded p-1.5">
          <span className="text-text-muted">Prév.</span>
          <p className="font-mono font-bold">{signal.event.forecast}</p>
        </div>
        <div className="bg-background rounded p-1.5">
          <span className="text-text-muted">Préc.</span>
          <p className="font-mono">{signal.event.previous}</p>
        </div>
        <div className="bg-background rounded p-1.5">
          <span className="text-text-muted">Signal</span>
          <p className={`font-mono font-bold ${signal.side === "buy" ? "text-success" : signal.side === "sell" ? "text-danger" : "text-text-muted"}`}>
            {signal.side ? signal.side.toUpperCase() : "NEUTRE"}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-text-muted">Probabilité</span>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-background rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${signal.probability > 70 ? "bg-success" : signal.probability > 50 ? "bg-warning" : "bg-danger"}`}
              style={{ width: `${signal.probability}%` }} />
          </div>
          <span className={`font-bold font-mono text-xs ${signal.probability > 70 ? "text-success" : signal.probability > 50 ? "text-warning" : "text-danger"}`}>
            {signal.probability}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 text-[10px] mb-2 bg-background/60 rounded-lg p-2">
        <div className="text-center">
          <span className="text-text-muted block">Paire</span>
          <span className="text-text font-mono font-bold">{signal.pair}</span>
        </div>
        <div className="text-center">
          <span className="text-text-muted block">Entry</span>
          <span className="text-text font-mono font-bold">{signal.entry.toFixed(5)}</span>
        </div>
        <div className="text-center">
          <span className="text-text-muted block">TP</span>
          <span className="text-success font-mono font-bold">{signal.takeProfit.toFixed(5)}</span>
        </div>
        <div className="text-center">
          <span className="text-text-muted block">SL</span>
          <span className="text-danger font-mono font-bold">{signal.stopLoss.toFixed(5)}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div className="bg-background/30 rounded p-1.5 text-center">
          <span className="text-text-muted block">TP1</span>
          <span className="text-success font-mono font-bold">{signal.targets.tp1}</span>
        </div>
        <div className="bg-background/30 rounded p-1.5 text-center">
          <span className="text-text-muted block">TP2</span>
          <span className="text-primary font-mono font-bold">{signal.targets.tp2}</span>
        </div>
        <div className="bg-background/30 rounded p-1.5 text-center">
          <span className="text-text-muted block">SL</span>
          <span className="text-danger font-mono font-bold">{signal.targets.sl}</span>
        </div>
      </div>

      <p className="text-xs text-text-secondary italic">{signal.reasoning}</p>
    </div>
  );
}

export default function NewsTrader() {
  const [data, setData] = useState<{ events: EconomicEvent[]; signals: NewsSignal[]; marketContext: any; source?: string } | null>(null);
  const [filter, setFilter] = useState<"all" | EconomicEvent["impact"]>("all");
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string>("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/news");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setSource(json.source || "");
      }
    } catch {
      // fallback silencieux
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 300000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filtered = filter === "all" ? (data?.events || []) : (data?.events || []).filter(e => e.impact === filter);
  const upcomingCount = (data?.events || []).filter(e => e.status === "upcoming").length;
  const highImpactCount = (data?.events || []).filter(e => e.impact === "high" && e.status === "upcoming").length;

  return (
    <section className="max-w-6xl mx-auto py-12 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Newspaper size={24} className="text-primary" />
            <h2 className="text-2xl font-bold">News Trading</h2>
            {source === "finnhub" ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/20 text-success font-semibold animate-pulse">
                ● EN DIRECT
              </span>
            ) : source === "simulated" ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/20 text-warning font-semibold">
                SIMULÉ
              </span>
            ) : null}
          </div>
          <p className="text-text-secondary text-sm">
            {source === "finnhub"
              ? "Données en temps réel depuis Finnhub."
              : "Anticipez les mouvements du marché avant les annonces économiques majeures."}
          </p>
        </div>
        <button onClick={fetchData} disabled={loading}
          className="p-2 rounded-lg border border-border hover:bg-surface transition-colors disabled:opacity-50">
          <RefreshCw size={16} className={`text-text-muted ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !data && (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      )}

      {!loading && !data && (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <BarChart3 size={40} className="mx-auto text-text-muted mb-3" />
          <p className="text-text-muted mb-1">Aucune donnée économique disponible</p>
          <p className="text-xs text-text-secondary">Revenez plus tard ou vérifiez votre connexion.</p>
        </div>
      )}

      {data && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl border border-border bg-surface p-4 text-center">
              <Calendar size={18} className="mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold text-text">{upcomingCount}</p>
              <p className="text-xs text-text-muted">Annonces à venir</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 text-center">
              <AlertTriangle size={18} className="mx-auto text-danger mb-1" />
              <p className="text-2xl font-bold text-danger">{highImpactCount}</p>
              <p className="text-xs text-text-muted">Haut impact</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 text-center">
              <TrendingUp size={18} className="mx-auto text-success mb-1" />
              <p className="text-2xl font-bold text-success">{data.signals.length}</p>
              <p className="text-xs text-text-muted">Signaux générés</p>
            </div>
          </div>

          {/* Signals */}
          {data.signals.length > 0 && (
            <>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp size={16} className="text-success" />
                Signaux recommandés
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {data.signals.slice(0, 6).map((sig) => (
                  <SignalCard key={sig.event.id} signal={sig} />
                ))}
              </div>
            </>
          )}

          {/* Full calendar */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Calendrier économique</h3>
            <div className="flex gap-2">
              {(["all", "high", "medium", "low"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${filter === f ? "bg-primary text-white" : "bg-surface text-text-secondary border border-border hover:text-text"}`}>
                  {f === "all" ? "Tous" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-3 font-medium">Date</th>
                  <th className="text-left py-3 px-3 font-medium">Heure</th>
                  <th className="text-left py-3 px-3 font-medium">Événement</th>
                  <th className="text-center py-3 px-3 font-medium">Impact</th>
                  <th className="text-right py-3 px-3 font-medium">Précédent</th>
                  <th className="text-right py-3 px-3 font-medium">Prévision</th>
                  <th className="text-right py-3 px-3 font-medium">Réel</th>
                  <th className="text-center py-3 px-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 20).map((ev) => {
                  const isHigh = ev.impact === "high";
                  return (
                    <tr key={ev.id} className={`border-b border-border/30 hover:bg-surface/50 transition ${isHigh ? "bg-danger/5" : ""}`}>
                      <td className="py-2.5 px-3 text-xs text-text-muted">{ev.date}</td>
                      <td className="py-2.5 px-3 font-mono text-xs text-text">{ev.time}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-xs text-text">{ev.title}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center"><ImpactBadge impact={ev.impact} /></td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs text-text-muted">{ev.previous}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs text-primary">{ev.forecast}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs">
                        {ev.actual ? (
                          <span className={ev.sentiment === "bullish" ? "text-success" : ev.sentiment === "bearish" ? "text-danger" : "text-text-muted"}>
                            {ev.actual}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-center"><StatusBadge status={ev.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Sentiment récent */}
          {(data.events || []).filter(e => e.status === "done" && e.sentiment).length > 0 && (
            <div className="mt-8 rounded-xl border border-border bg-surface p-6">
              <h3 className="font-semibold mb-3">Derniers résultats</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(data.events || []).filter(e => e.status === "done" && e.sentiment).slice(0, 8).map((ev) => (
                  <div key={ev.id} className="bg-background rounded-lg p-3 text-xs">
                    <p className="text-text-muted truncate">{ev.title.split("—")[1] || ev.title}</p>
                    <p className="mt-1"><SentimentBadge sentiment={ev.sentiment} confidence={ev.confidence} /></p>
                    <p className="text-text-muted mt-0.5">Réel: {ev.actual} / Prév: {ev.forecast}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
