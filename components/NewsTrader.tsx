"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, AlertTriangle, BarChart3, Loader2, RefreshCw,
  Zap, Flame, Droplet, Target, Crosshair, Layers, DollarSign,
} from "lucide-react";

interface FVG {
  type: "bullish" | "bearish";
  bottom: number;
  top: number;
  mitigated: boolean;
}

interface OTE {
  low: number;
  high: number;
}

interface PDArray {
  zone: "premium" | "discount";
  distanceFromMid: number;
}

interface Displacement {
  direction: "bullish" | "bearish";
  ratio: number;
}

interface OrderBlock {
  price: number;
  type: "bullish" | "bearish";
  strength: number;
}

interface SRLevel {
  price: number;
  strength: number;
  type: "support" | "resistance";
}

interface CandlePattern {
  name: string;
  signal: string;
  strength: number;
}

interface PairAnalysis {
  key: string;
  pair: string;
  type: "forex" | "commodity";
  currentPrice: number;
  probability: number;
  expectedDirection: "up" | "down";
  estimatedMagnitude: string;
  isSpikeImminent: boolean;
  levelTouched: boolean;
  isApproaching: boolean;
  signal: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  rsi: number;
  trend: string;
  regime: string;
  volatility: string;
  killzone: string;
  fvg: FVG | null;
  ote: OTE | null;
  pdArray: PDArray | null;
  displacement: Displacement | null;
  orderBlocks: OrderBlock[];
  sRlevels: SRLevel[];
  candlePatterns: CandlePattern[];
  upScore: number;
  downScore: number;
}

interface SMTDivergence {
  pairA: string;
  pairB: string;
  type: string;
  signal: "bullish" | "bearish";
  strength: number;
  aRsi?: number;
  bRsi?: number;
  aDirection?: string;
  bDirection?: string;
}

interface ForexData {
  connected: boolean;
  pairs: PairAnalysis[];
  signals: PairAnalysis[];
  divergences: SMTDivergence[];
  killzone: string;
  source: string;
  timestamp: number;
}

function formatPrice(price: number, pair: string): string {
  if (pair === "XAU/USD") return price.toFixed(2);
  if (pair.includes("JPY")) return price.toFixed(2);
  return price.toFixed(5);
}

function DirectionIcon({ dir }: { dir: string }) {
  if (dir === "up") return <TrendingUp size={14} className="text-success" />;
  if (dir === "down") return <TrendingDown size={14} className="text-danger" />;
  return null;
}

function ProbBar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-success" : value >= 65 ? "bg-warning" : "bg-danger";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-surface-light overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className={`font-mono text-xs font-bold ${value >= 80 ? "text-success" : value >= 65 ? "text-warning" : "text-text-muted"}`}>{value}%</span>
    </div>
  );
}

function PairCard({ pair }: { pair: PairAnalysis }) {
  const hasSignal = pair.signal !== "WATCH" && pair.probability >= 65;
  const borderColor = hasSignal
    ? pair.expectedDirection === "up" ? "border-success/30 bg-success/3" : "border-danger/30 bg-danger/3"
    : "border-border bg-surface";

  return (
    <div className={`rounded-xl border p-3 ${borderColor}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {pair.type === "commodity" ? <Droplet size={16} className="text-warning" /> : <DollarSign size={16} className="text-primary" />}
          <span className="font-bold text-sm">{pair.pair}</span>
          {pair.isSpikeImminent && <span className="text-[9px] px-1.5 py-0.5 rounded bg-danger/20 text-danger border border-danger/30 font-bold">ALERTE</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-light text-text-muted border border-border">{pair.killzone}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${pair.regime === "trending_bull" ? "text-success bg-success/10" : pair.regime === "trending_bear" ? "text-danger bg-danger/10" : "text-text-muted bg-surface-light"}`}>
            {pair.trend}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-lg">{formatPrice(pair.currentPrice, pair.pair)}</span>
          <DirectionIcon dir={pair.expectedDirection} />
          {hasSignal && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pair.signal === "STRONG_BUY" || pair.signal === "STRONG_SELL" ? "bg-primary/20 text-primary border border-primary/30" : "bg-surface-light text-text-muted border border-border"}`}>
              {pair.signal}
            </span>
          )}
        </div>
        <ProbBar value={pair.probability} />
      </div>

      {hasSignal && (
        <div className="grid grid-cols-3 gap-1 text-[10px] mb-2 bg-background/60 rounded-lg p-2">
          <div className="text-center">
            <span className="text-text-muted block">Entry</span>
            <span className="font-mono font-bold text-text">{formatPrice(pair.entryPrice, pair.pair)}</span>
          </div>
          <div className="text-center">
            <span className="text-text-muted block">TP</span>
            <span className="font-mono font-bold text-success">{formatPrice(pair.takeProfit, pair.pair)}</span>
          </div>
          <div className="text-center">
            <span className="text-text-muted block">SL</span>
            <span className="font-mono font-bold text-danger">{formatPrice(pair.stopLoss, pair.pair)}</span>
          </div>
        </div>
      )}

      {/* SMC/ICT badges */}
      <div className="flex flex-wrap gap-1 mb-1">
        {pair.fvg && !pair.fvg.mitigated && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${pair.fvg.type === "bullish" ? "bg-success/10 text-success border border-success/20" : "bg-danger/10 text-danger border border-danger/20"}`}>
            FVG {pair.fvg.type === "bullish" ? "+" : "-"}
          </span>
        )}
        {pair.ote && (
          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-primary/10 text-primary border border-primary/20">
            OTE
          </span>
        )}
        {pair.pdArray && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${pair.pdArray.zone === "premium" ? "bg-danger/10 text-danger border border-danger/20" : "bg-success/10 text-success border border-success/20"}`}>
            {pair.pdArray.zone === "premium" ? "Premium" : "Discount"}
          </span>
        )}
        {pair.displacement && (
          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-warning/10 text-warning border border-warning/20">
            Disp {pair.displacement.direction === "bullish" ? "↑" : "↓"} x{pair.displacement.ratio}
          </span>
        )}
        {pair.candlePatterns.map((p, i) => (
          <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${p.signal === "bullish" ? "bg-success/10 text-success border border-success/20" : p.signal === "bearish" ? "bg-danger/10 text-danger border border-danger/20" : "bg-surface-light text-text-muted border border-border"}`}>
            {p.name}
          </span>
        ))}
      </div>

      {/* Scores */}
      <div className="flex items-center gap-3 text-[10px] text-text-muted">
        <span>↑{pair.upScore} ↓{pair.downScore}</span>
        <span>RSI {pair.rsi}</span>
        <span>Mag {pair.estimatedMagnitude}</span>
        <span>{pair.levelTouched ? "Touché" : pair.isApproaching ? "Approche" : ""}</span>
      </div>
    </div>
  );
}

function DivergenceBadge({ div }: { div: SMTDivergence }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${div.signal === "bullish" ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5"}`}>
      <div className="flex items-center gap-2">
        <Layers size={12} className={div.signal === "bullish" ? "text-success" : "text-danger"} />
        <span className="font-semibold">SMT {div.type}</span>
        <span className={div.signal === "bullish" ? "text-success" : "text-danger"}>{div.signal === "bullish" ? "↑" : "↓"}</span>
      </div>
      <p className="text-text-muted mt-0.5">{div.pairA} vs {div.pairB} (force: {div.strength})</p>
      {div.aRsi != null && <p className="text-text-muted">RSI: {div.pairA}={div.aRsi} / {div.pairB}={div.bRsi}</p>}
    </div>
  );
}

export default function NewsTrader() {
  const [data, setData] = useState<ForexData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "signals">("signals");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/news");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const pairsToShow = filter === "signals"
    ? (data?.signals || [])
    : (data?.pairs || []);

  const highProbCount = (data?.signals || []).filter(s => s.probability >= 80).length;
  const signalCount = (data?.signals || []).length;

  return (
    <section className="max-w-6xl mx-auto py-12 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Target size={24} className="text-primary" />
            <h2 className="text-2xl font-bold">SMC / ICT Analysis</h2>
            {data?.connected === true && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/20 text-success font-semibold animate-pulse">● EN DIRECT</span>
            )}
          </div>
          <p className="text-text-secondary text-sm">
            Fair Value Gaps · Optimal Trade Entry · Premium/Discount · SMT Divergence · Order Blocks
            {data?.killzone && <span className="ml-2 text-primary">· {data.killzone}</span>}
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

      {!loading && !data?.connected && !data?.pairs?.length && (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <BarChart3 size={40} className="mx-auto text-text-muted mb-3" />
          <p className="text-text-muted mb-1">Connexion en cours...</p>
          <p className="text-xs text-text-secondary">WebSocket Deriv en cours de connexion aux paires forex.</p>
        </div>
      )}

      {data?.connected === false && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-12 text-center">
          <AlertTriangle size={40} className="mx-auto text-danger mb-3" />
          <p className="text-danger font-medium mb-1">Déconnecté</p>
          <p className="text-xs text-text-secondary">Impossible de se connecter à Deriv WebSocket.</p>
        </div>
      )}

      {data && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-border bg-surface p-4 text-center">
              <BarChart3 size={18} className="mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold text-text">{data.pairs.length}</p>
              <p className="text-xs text-text-muted">Paires analysées</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 text-center">
              <Target size={18} className="mx-auto text-success mb-1" />
              <p className="text-2xl font-bold text-success">{signalCount}</p>
              <p className="text-xs text-text-muted">Signaux actifs</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 text-center">
              <Zap size={18} className="mx-auto text-warning mb-1" />
              <p className="text-2xl font-bold text-warning">{highProbCount}</p>
              <p className="text-xs text-text-muted">≥80% probabilité</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 text-center">
              <Layers size={18} className="mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold text-primary">{data.divergences.length}</p>
              <p className="text-xs text-text-muted">SMT divergences</p>
            </div>
          </div>

          {/* SMT Divergences */}
          {data.divergences.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Layers size={16} className="text-primary" />
                SMT Divergences
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {data.divergences.map((div, i) => (
                  <DivergenceBadge key={i} div={div} />
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{filter === "signals" ? "Signaux" : "Toutes les paires"}</h3>
            <div className="flex gap-2">
              {(["signals", "all"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${filter === f ? "bg-primary text-white" : "bg-surface text-text-secondary border border-border hover:text-text"}`}>
                  {f === "signals" ? `Signaux (${signalCount})` : `Toutes (${data.pairs.length})`}
                </button>
              ))}
            </div>
          </div>

          {/* Pairs grid */}
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pairsToShow.map((pair) => (
              <PairCard key={pair.key} pair={pair} />
            ))}
          </div>

          {filter === "signals" && signalCount === 0 && data.pairs.length > 0 && (
            <div className="mt-6 p-6 rounded-xl border border-border bg-surface text-center text-sm text-text-secondary">
              <Crosshair size={24} className="mx-auto mb-2 text-text-muted" />
              Aucun信号 de retournement détecté pour le moment. Le scan surveille les 8 paires en continu avec les concepts SMC/ICT.
            </div>
          )}

          {/* SMC/ICT legend */}
          <div className="mt-8 rounded-xl border border-border bg-surface p-6">
            <h3 className="font-bold text-lg mb-4">Concepts SMC / ICT utilisés</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-semibold text-primary mb-1">Fair Value Gap (FVG)</h4>
                <p className="text-text-secondary text-xs">Écart de prix entre 3 bougies consécutives. Non comblé = zone d&apos;intérêt pour un retournement.</p>
              </div>
              <div>
                <h4 className="font-semibold text-primary mb-1">Optimal Trade Entry (OTE)</h4>
                <p className="text-text-secondary text-xs">Zone Fibonacci 0.618-0.79. Le prix qui retrace dans cette zone offre le meilleur ratio risque/rendement.</p>
              </div>
              <div>
                <h4 className="font-semibold text-primary mb-1">Premium / Discount</h4>
                <p className="text-text-secondary text-xs">La zone au-dessus de 50% de la range = Premium (vendre), en dessous = Discount (acheter).</p>
              </div>
              <div>
                <h4 className="font-semibold text-primary mb-1">SMT Divergence</h4>
                <p className="text-text-secondary text-xs">Divergence entre paires corrélées (EUR/USD vs USD/CHF, GBP/USD vs USD/JPY). Signale un retournement imminent.</p>
              </div>
              <div>
                <h4 className="font-semibold text-primary mb-1">Displacement</h4>
                <p className="text-text-secondary text-xs">Bougie agressive avec un corps 2x plus grand que la moyenne. Montre l&apos;intention des institutionnels.</p>
              </div>
              <div>
                <h4 className="font-semibold text-primary mb-1">Order Blocks + S/R</h4>
                <p className="text-text-secondary text-xs">Blocs d&apos;ordres institutionnels avec clustering de pivots S/R. Confluence multi-timeframe (15m, 30m, 1h, 2h).</p>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
