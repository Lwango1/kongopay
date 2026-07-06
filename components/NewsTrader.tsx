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
  const hasSignal = pair.signal !== "WATCH";
  const borderColor = hasSignal
    ? pair.expectedDirection === "up" ? "border-success/30 bg-success/3" : "border-danger/30 bg-danger/3"
    : "border-border bg-surface";

  const entryDist = pair.entryPrice ? ((pair.entryPrice - pair.currentPrice) / pair.currentPrice * 100) : 0;
  const tpDist = pair.takeProfit ? ((pair.takeProfit - pair.currentPrice) / pair.currentPrice * 100) : 0;
  const slDist = pair.stopLoss ? ((pair.stopLoss - pair.currentPrice) / pair.currentPrice * 100) : 0;
  const rr = pair.takeProfit && pair.stopLoss ? Math.abs((pair.takeProfit - pair.entryPrice) / (pair.stopLoss - pair.entryPrice)) : 0;

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
        <div className="grid grid-cols-3 gap-1.5 text-[11px] mb-2 bg-background/60 rounded-lg p-2.5">
          <div className="text-center border-r border-border/40">
            <span className="text-text-muted block text-[9px] uppercase tracking-wider mb-0.5">Entry</span>
            <span className="font-mono font-bold text-text">{formatPrice(pair.entryPrice, pair.pair)}</span>
            <span className={`block text-[9px] ${entryDist >= 0 ? "text-danger" : "text-success"}`}>{entryDist >= 0 ? "+" : ""}{entryDist.toFixed(2)}%</span>
          </div>
          <div className="text-center border-r border-border/40">
            <span className="text-text-muted block text-[9px] uppercase tracking-wider mb-0.5">TP</span>
            <span className="font-mono font-bold text-success">{formatPrice(pair.takeProfit, pair.pair)}</span>
            <span className="block text-[9px] text-success">+{Math.abs(tpDist).toFixed(2)}%</span>
          </div>
          <div className="text-center">
            <span className="text-text-muted block text-[9px] uppercase tracking-wider mb-0.5">SL</span>
            <span className="font-mono font-bold text-danger">{formatPrice(pair.stopLoss, pair.pair)}</span>
            <span className="block text-[9px] text-danger">-{Math.abs(slDist).toFixed(2)}%</span>
          </div>
        </div>
      )}
      {hasSignal && (
        <div className="flex items-center justify-between text-[10px] px-1 mb-1">
          <span className="text-text-muted">R:R <span className="font-bold text-text">{rr.toFixed(1)}</span></span>
          <span className={`font-semibold ${pair.expectedDirection === "up" ? "text-success" : "text-danger"}`}>
            {pair.expectedDirection === "up" ? "LONG " : "SHORT "}
            <span className="text-text-muted font-normal">| {formatPrice(pair.entryPrice, pair.pair)}</span>
          </span>
        </div>
      )}

      {/* S/R Levels */}
      {pair.sRlevels && pair.sRlevels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {pair.sRlevels.slice(0, 3).map((l, i) => (
            <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${l.type === "support" ? "bg-success/10 text-success border border-success/20" : "bg-danger/10 text-danger border border-danger/20"}`}>
              {l.type === "support" ? "S" : "R"}{l.strength} @ {formatPrice(l.price, pair.pair)}
            </span>
          ))}
        </div>
      )}

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
            <h2 className="text-2xl font-bold">Analyse S/R Niveaux</h2>
            {data?.connected === true && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/20 text-success font-semibold animate-pulse">● EN DIRECT</span>
            )}
          </div>
          <p className="text-text-secondary text-sm">
            Supports · Résistances · Proximité · Force des niveaux · Rupture
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
              Aucun signal de retournement détecté pour le moment. Le scan surveille les 8 paires en continu avec les niveaux S/R.
            </div>
          )}

          {/* S/R legend */}
          <div className="mt-8 rounded-xl border border-border bg-surface p-6">
            <h3 className="font-bold text-lg mb-4">Analyse par Niveaux S/R</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-semibold text-primary mb-1">Support</h4>
                <p className="text-text-secondary text-xs">Niveau de prix où la pression acheteuse est suffisante pour stopper la baisse. Le prix a rebondi plusieurs fois à ce niveau.</p>
              </div>
              <div>
                <h4 className="font-semibold text-primary mb-1">Résistance</h4>
                <p className="text-text-secondary text-xs">Niveau de prix où la pression vendeuse empêche la hausse. Plus le niveau est fort, plus le rejet est probable.</p>
              </div>
              <div>
                <h4 className="font-semibold text-primary mb-1">Proximité</h4>
                <p className="text-text-secondary text-xs">Le prix doit être à moins de 0.3% du niveau S/R pour générer un signal. Plus le niveau est proche, plus la probabilité est élevée.</p>
              </div>
              <div>
                <h4 className="font-semibold text-primary mb-1">Force du niveau</h4>
                <p className="text-text-secondary text-xs">Basée sur le nombre de pivots de prix au même niveau multiple fois (strength 1-10). Minimum strength 3 pour un signal fiable.</p>
              </div>
              <div>
                <h4 className="font-semibold text-primary mb-1">Touché & Approche</h4>
                <p className="text-text-secondary text-xs">Le prix ayant déjà touché le niveau dans les 40 derniers ticks + mouvement actuel vers le niveau = signal renforcé.</p>
              </div>
              <div>
                <h4 className="font-semibold text-primary mb-1">SL / TP</h4>
                <p className="text-text-secondary text-xs">Stop Loss placé au-delà du niveau S/R. Take Profit à 2x la distance SL pour un ratio risque/rendement de 1:2.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
