"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, TrendingDown, Zap, Trophy, Clock } from "lucide-react";

interface DerivState {
  boom: { price: number; change24h: number; history: number[] };
  crash: { price: number; change24h: number; history: number[] };
  timestamp: number;
}

type Prediction = "UP" | "DOWN" | null;

export default function PredictionGame() {
  const [state, setState] = useState<DerivState | null>(null);
  const [activeType, setActiveType] = useState<"boom" | "crash">("boom");
  const [prediction, setPrediction] = useState<Prediction>(null);
  const [betAmount, setBetAmount] = useState(100);
  const [countdown, setCountdown] = useState(30);
  const [result, setResult] = useState<"win" | "lose" | null>(null);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [locked, setLocked] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/deriv/state");
      const data = await res.json();
      setState(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 1000);
    return () => clearInterval(interval);
  }, [fetchState]);

  useEffect(() => {
    if (locked && countdown > 0) {
      const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
      return () => clearInterval(timer);
    }
    if (countdown === 0 && locked) {
      if (state) {
        const current = activeType === "boom" ? state.boom.price : state.crash.price;
        const prevHistory = activeType === "boom" ? state.boom.history : state.crash.history;
        const prevPrice = prevHistory[prevHistory.length - 2] || current;

        if (prediction === "UP" && current >= prevPrice) {
          setResult("win");
          setScore((s) => s + betAmount);
        } else if (prediction === "DOWN" && current <= prevPrice) {
          setResult("win");
          setScore((s) => s + betAmount);
        } else {
          setResult("lose");
          setScore((s) => s - betAmount);
        }
      }
      setLocked(false);
      setPrediction(null);
    }
  }, [countdown, locked, state, activeType, prediction, betAmount]);

  const placePrediction = (dir: Prediction) => {
    if (locked) return;
    setPrediction(dir);
    setCountdown(30);
    setLocked(true);
    setResult(null);
    setRound((r) => r + 1);
  };

  const currentPrice = state
    ? activeType === "boom" ? state.boom.price : state.crash.price
    : 0;
  const change24h = state
    ? activeType === "boom" ? state.boom.change24h : state.crash.change24h
    : 0;
  const history = state
    ? activeType === "boom" ? state.boom.history : state.crash.history
    : [];
  const minHistory = Math.min(...(history.length ? history : [0]));
  const maxHistory = Math.max(...(history.length ? history : [0]));
  const range = maxHistory - minHistory || 1;

  return (
    <section className="py-20 px-4 border-t border-border">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 flex items-center justify-center gap-3">
            <Zap className="text-warning" size={32} />
            Prédisez le Marché
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            Devinez si le prix va monter ou baisser dans les 30 prochaines secondes sur les indices synthétiques Boom & Crash.
            Gagnez des points !
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex gap-2">
              <button onClick={() => { setActiveType("boom"); setPrediction(null); setLocked(false); setResult(null); }}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${activeType === "boom" ? "bg-success/20 text-success border border-success/40" : "bg-surface text-text-secondary border border-border hover:border-success/30"}`}>
                <TrendingUp size={16} className="inline mr-1" /> Boom
              </button>
              <button onClick={() => { setActiveType("crash"); setPrediction(null); setLocked(false); setResult(null); }}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${activeType === "crash" ? "bg-danger/20 text-danger border border-danger/40" : "bg-surface text-text-secondary border border-border hover:border-danger/30"}`}>
                <TrendingDown size={16} className="inline mr-1" /> Crash
              </button>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold uppercase text-text-muted">{activeType === "boom" ? "Boom" : "Crash"} Index</span>
                <span className={`text-sm font-mono ${change24h >= 0 ? "text-success" : "text-danger"}`}>
                  {change24h >= 0 ? "+" : ""}{change24h.toFixed(2)}%
                </span>
              </div>
              <div className="text-3xl font-bold font-mono mb-4">
                ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="h-32 flex items-end gap-[2px]">
                {history.slice(-60).map((p, i) => (
                  <div key={i}
                    className="flex-1 rounded-t-sm transition-all"
                    style={{
                      height: `${((p - minHistory) / range) * 100}%`,
                      background: activeType === "boom"
                        ? `rgba(34, 197, 94, ${0.3 + (p / maxHistory) * 0.5})`
                        : `rgba(251, 113, 133, ${0.3 + (p / maxHistory) * 0.5})`,
                    }}
                  />
                ))}
              </div>
            </div>

            {locked && (
              <div className="flex items-center justify-center gap-3 py-3 rounded-xl bg-surface border border-border">
                <Clock size={20} className="text-primary animate-pulse" />
                <span className="text-lg font-bold font-mono">{countdown}s</span>
                <span className="text-text-secondary text-sm">restantes</span>
              </div>
            )}

            {result && (
              <div className={`py-3 px-4 rounded-xl text-center font-semibold ${result === "win" ? "bg-success/20 text-success border border-success/30" : "bg-danger/20 text-danger border border-danger/30"}`}>
                {result === "win" ? `+${betAmount} points ! Bonne prédiction !` : `-${betAmount} points ! Mauvaise prédiction !`}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Trophy size={18} className="text-warning" />
                Score
              </h3>
              <div className="text-3xl font-bold text-primary mb-1">{score}</div>
              <div className="text-xs text-text-muted">points • {round} rounds</div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="font-semibold mb-3">Placer une prédiction</h3>
              <div className="flex gap-2 mb-4">
                {[10, 50, 100, 500].map((a) => (
                  <button key={a} onClick={() => setBetAmount(a)}
                    className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${betAmount === a ? "bg-primary/20 border-primary/40 text-primary" : "bg-background border-border text-text-muted hover:border-primary/30"}`}>
                    {a}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => placePrediction("UP")} disabled={locked}
                  className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 transition-all ${locked ? "opacity-50 cursor-not-allowed" : "hover:scale-105"} bg-success/20 text-success border border-success/30`}>
                  <TrendingUp size={16} /> HAUSSE
                </button>
                <button onClick={() => placePrediction("DOWN")} disabled={locked}
                  className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 transition-all ${locked ? "opacity-50 cursor-not-allowed" : "hover:scale-105"} bg-danger/20 text-danger border border-danger/30`}>
                  <TrendingDown size={16} /> BAISSE
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface/50 p-4">
              <h4 className="text-xs font-semibold text-text-muted uppercase mb-2">Classement</h4>
              <div className="text-sm text-text-secondary">Aucun joueur pour le moment</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
