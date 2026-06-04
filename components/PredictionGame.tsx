"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, TrendingDown, Zap, Trophy, Clock, Flame, Droplet } from "lucide-react";

interface IndexData {
  price: number;
  change24h: number;
  history: number[];
  type: string;
  number: number;
}

type Prediction = "UP" | "DOWN" | null;

const INDICES = [
  { type: "BOOM", number: 500, icon: Flame, color: "#22c55e", label: "Boom 500" },
  { type: "BOOM", number: 900, icon: Flame, color: "#16a34a", label: "Boom 900" },
  { type: "BOOM", number: 1000, icon: Flame, color: "#15803d", label: "Boom 1000" },
  { type: "CRASH", number: 500, icon: Droplet, color: "#fb7185", label: "Crash 500" },
  { type: "CRASH", number: 900, icon: Droplet, color: "#f43f5e", label: "Crash 900" },
  { type: "CRASH", number: 1000, icon: Droplet, color: "#be123c", label: "Crash 1000" },
];

export default function PredictionGame() {
  const [state, setState] = useState<Record<string, IndexData> | null>(null);
  const [activeKey, setActiveKey] = useState("BOOM_500");
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
      if (res.ok) setState(await res.json());
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
    if (countdown === 0 && locked && state) {
      const currentIdx = state[activeKey];
      if (currentIdx) {
        const current = currentIdx.price;
        const prev = currentIdx.history[currentIdx.history.length - 2] || current;

        if ((prediction === "UP" && current >= prev) || (prediction === "DOWN" && current <= prev)) {
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
  }, [countdown, locked, state, activeKey, prediction, betAmount]);

  const placePrediction = (dir: Prediction) => {
    if (locked) return;
    setPrediction(dir);
    setCountdown(30);
    setLocked(true);
    setResult(null);
    setRound((r) => r + 1);
  };

  const activeIdx = INDICES.find((i) => `${i.type}_${i.number}` === activeKey);
  const currentIdxData = state?.[activeKey];
  const price = currentIdxData?.price ?? 0;
  const change = currentIdxData?.change24h ?? 0;
  const history = currentIdxData?.history ?? [];
  const minH = Math.min(...history, 0);
  const maxH = Math.max(...history, 1);
  const range = maxH - minH || 1;

  return (
    <section className="py-20 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 flex items-center justify-center gap-3">
            <Zap className="text-warning" size={32} />
            Prédisez le Marché
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            Devinez si le prix va monter ou baisser dans les 30 prochaines secondes sur les indices synthétiques.
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-2">
            {INDICES.map((idx) => {
              const key = `${idx.type}_${idx.number}`;
              const isActive = key === activeKey;
              return (
                <button key={key} onClick={() => { setActiveKey(key); setPrediction(null); setLocked(false); setResult(null); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-surface border border-primary/40 text-text" : "bg-background border border-border text-text-secondary hover:bg-surface hover:border-border"}`}>
                  <idx.icon size={18} style={{ color: idx.color }} />
                  <span>{idx.label}</span>
                  {state?.[key] && (
                    <span className={`ml-auto text-xs font-mono ${(state[key].change24h ?? 0) >= 0 ? "text-success" : "text-danger"}`}>
                      {(state[key].change24h ?? 0) >= 0 ? "+" : ""}{(state[key].change24h ?? 0).toFixed(1)}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {activeIdx && <activeIdx.icon size={20} style={{ color: activeIdx.color }} />}
                  <span className="font-semibold">{activeIdx?.label ?? "Select"}</span>
                </div>
                <span className={`text-sm font-mono ${change >= 0 ? "text-success" : "text-danger"}`}>
                  {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                </span>
              </div>
              <div className="text-3xl font-bold font-mono mb-4">
                ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="h-40 flex items-end gap-[2px]">
                {history.slice(-80).map((p, i) => (
                  <div key={i} className="flex-1 rounded-t-sm transition-all"
                    style={{
                      height: `${((p - minH) / range) * 100}%`,
                      background: activeIdx?.type === "BOOM"
                        ? `rgba(34, 197, 94, ${0.3 + (p / maxH) * 0.5})`
                        : `rgba(251, 113, 133, ${0.3 + (p / maxH) * 0.5})`,
                    }} />
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

            <div className="flex gap-2">
              <button onClick={() => placePrediction("UP")} disabled={locked}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 transition-all ${locked ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02]"} bg-success/20 text-success border border-success/30`}>
                <TrendingUp size={16} /> HAUSSE
              </button>
              <button onClick={() => placePrediction("DOWN")} disabled={locked}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 transition-all ${locked ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02]"} bg-danger/20 text-danger border border-danger/30`}>
                <TrendingDown size={16} /> BAISSE
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="rounded-xl border border-border bg-surface/50 p-4">
            <h4 className="text-xs font-semibold text-text-muted uppercase mb-2 flex items-center gap-2"><Trophy size={14} className="text-warning" /> Score</h4>
            <div className="text-2xl font-bold text-primary">{score}</div>
            <div className="text-xs text-text-muted">{round} rounds</div>
          </div>
          <div className="rounded-xl border border-border bg-surface/50 p-4">
            <h4 className="text-xs font-semibold text-text-muted uppercase mb-2">Mise</h4>
            <div className="flex gap-1 mb-2">
              {[10, 50, 100, 500].map((a) => (
                <button key={a} onClick={() => setBetAmount(a)}
                  className={`flex-1 py-1 text-xs rounded border transition-colors ${betAmount === a ? "bg-primary/20 border-primary/40 text-primary" : "bg-background border-border text-text-muted hover:border-primary/30"}`}>{a}</button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface/50 p-4 sm:col-span-2">
            <h4 className="text-xs font-semibold text-text-muted uppercase mb-2">Classement</h4>
            <p className="text-sm text-text-secondary">Connectez-vous pour apparaître</p>
          </div>
        </div>
      </div>
    </section>
  );
}
