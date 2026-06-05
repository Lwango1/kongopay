"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from "recharts";
import {
  TrendingUp, AlertTriangle, Flame, Droplet,
  Maximize2, Minimize2, Pause, Play, Wifi, WifiOff,
} from "lucide-react";

interface IndexData {
  price: number;
  change24h: number;
  history: number[];
  type: string;
  number: number;
  lastSpikeTime: number;
  lastSpikeDirection: "up" | "down" | null;
  connected: boolean;
}

interface SRLevel {
  price: number;
  strength: number;
  type: "support" | "resistance";
}

interface SpikePrediction {
  spikeProbability: number;
  expectedDirection: string;
  estimatedMagnitude: string;
  timeSinceLastSpike: number;
  isSpikeImminent: boolean;
  pricePosition: number;
  referenceLevel?: number;
  referenceStrength?: number;
  distancePercent?: number;
  consecutiveMoves?: number;
  sRlevels?: SRLevel[];
  error?: string;
}

const INDICES = [
  { type: "BOOM", number: 500, label: "Boom 500", color: "#22c55e" },
  { type: "BOOM", number: 900, label: "Boom 900", color: "#16a34a" },
  { type: "BOOM", number: 1000, label: "Boom 1000", color: "#15803d" },
  { type: "CRASH", number: 500, label: "Crash 500", color: "#fb7185" },
  { type: "CRASH", number: 900, label: "Crash 900", color: "#f43f5e" },
  { type: "CRASH", number: 1000, label: "Crash 1000", color: "#be123c" },
];

function MiniChart({ data, color }: { data: number[]; color: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const chartData = data.map((v, i) => ({ i, v }));

  return (
    <ResponsiveContainer width="100%" height={60}>
      <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#grad-${color.replace("#", "")})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function FullChart({ data, color, label }: { data: { t: string; p: number }[]; color: string; label: string }) {
  const min = Math.min(...data.map(d => d.p));
  const max = Math.max(...data.map(d => d.p));
  const range = max - min || 1;
  const padding = range * 0.1;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
        <defs>
          <linearGradient id={`full-grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.4} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
        <XAxis dataKey="t" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={{ stroke: "rgba(148,163,184,0.2)" }} tickLine={false} interval="preserveStartEnd" />
        <YAxis domain={[min - padding, max + padding]} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}K`} width={60} />
        <Tooltip
          contentStyle={{ backgroundColor: "#121b34", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "8px", fontSize: "12px", color: "#f8fafc" }}
          formatter={(value: number) => [`$${value.toFixed(2)}`, label]}
          labelStyle={{ color: "#94a3b8" }}
        />
        <Area type="monotone" dataKey="p" stroke={color} strokeWidth={2} fill={`url(#full-grad-${color.replace("#", "")})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function DerivChart() {
  const [state, setState] = useState<Record<string, IndexData> | null>(null);
  const [spikes, setSpikes] = useState<Record<string, SpikePrediction>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const [appIdMissing, setAppIdMissing] = useState(false);
  const pausedRef = useRef(paused);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  pausedRef.current = paused;

  const fetchData = useCallback(async () => {
    if (pausedRef.current) return;
    try {
      const res = await fetch("/api/deriv/state");
      if (res.ok) {
        const data = await res.json();
        setConnected(data.source === "deriv-live");
        const { timestamp, source, ...indices } = data;
        setState(indices);
      }
      const spikePromises = INDICES.map(async (idx) => {
        const key = `${idx.type}_${idx.number}`;
        const res = await fetch(`/api/deriv/spike?type=${idx.type}&number=${idx.number}`);
        if (res.ok) {
          const data = await res.json();
          return [key, data.prediction ?? data] as const;
        }
        return null;
      });
      const results = await Promise.all(spikePromises);
      const spikeMap: Record<string, SpikePrediction> = {};
      for (const r of results) {
        if (r) spikeMap[r[0]] = r[1];
      }
      setSpikes(spikeMap);
      const hasMissingAppId = Object.values(spikeMap).some((s: any) => s?.error?.includes("DERIV_APP_ID") || s?.error?.includes("pas assez"));
      setAppIdMissing(hasMissingAppId);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const chartData = (key: string): { t: string; p: number }[] => {
    if (!state?.[key]) return [];
    return state[key].history.map((p: number, i: number) => ({
      t: `-${state[key].history.length - i}`,
      p,
    }));
  };

  const currentPrice = (key: string) => state?.[key]?.price ?? 0;
  const currentChange = (key: string) => state?.[key]?.change24h ?? 0;
  const isAnyConnected = Object.values(state ?? {}).some((s) => s.connected);

  if (!state) {
    return (
      <section className="py-20 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-surface-light rounded w-64" />
            <div className="h-4 bg-surface-light rounded w-96" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-surface-light rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="deriv" className="py-20 px-4 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
                <TrendingUp className="text-primary" size={32} />
                Indices Synthétiques Deriv
              </h2>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isAnyConnected ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
                {isAnyConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                {isAnyConnected ? "Live" : "Déconnecté"}
              </div>
            </div>
            <p className="text-text-secondary mt-2">Boom & Crash — API Deriv (WebSocket) en temps réel</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaused(!paused)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${paused ? "bg-warning/20 text-warning border border-warning/30" : "bg-surface border border-border text-text-secondary hover:text-text"}`}
            >
              {paused ? <Play size={14} /> : <Pause size={14} />}
              {paused ? "Reprendre" : "Pause"}
            </button>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "grid" ? "bg-primary text-white" : "bg-surface text-text-secondary hover:text-text"}`}
              >Grille</button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-primary text-white" : "bg-surface text-text-secondary hover:text-text"}`}
              >Liste</button>
            </div>
          </div>
        </div>

        {appIdMissing && (
          <div className="mb-6 p-4 rounded-xl border border-warning/30 bg-warning/5">
            <p className="text-sm text-warning font-semibold mb-1">Clé API Deriv manquante</p>
            <p className="text-xs text-text-secondary">
              Ajoutez <code className="px-1 py-0.5 bg-surface-light rounded text-xs">NEXT_PUBLIC_DERIV_APP_ID=votre_app_id</code> dans le fichier <code className="px-1 py-0.5 bg-surface-light rounded text-xs">.env.local</code> à la racine du projet.
              Obtenez un app_id gratuit sur{" "}
              <a href="https://app.deriv.com/account/api-token" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">app.deriv.com</a>.
            </p>
          </div>
        )}

        {!isAnyConnected && !appIdMissing && (
          <div className="mb-6 p-4 rounded-xl border border-border bg-surface/50">
            <p className="text-sm text-text-secondary flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
              Connexion à l&apos;API Deriv en cours...
            </p>
          </div>
        )}

        {expanded && state[expanded] && (
          <div className="rounded-xl border border-border bg-surface p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {expanded.startsWith("BOOM") ? <Flame size={24} className="text-success" /> : <Droplet size={24} className="text-danger" />}
                <div>
                  <h3 className="font-bold text-lg">{INDICES.find(i => `${i.type}_${i.number}` === expanded)?.label}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-2xl font-bold font-mono">${currentPrice(expanded).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span className={`text-sm font-mono ${currentChange(expanded) >= 0 ? "text-success" : "text-danger"}`}>
                      {currentChange(expanded) >= 0 ? "+" : ""}{currentChange(expanded).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setExpanded(null)} className="p-2 hover:bg-surface-light rounded-lg transition-colors">
                <Minimize2 size={18} className="text-text-muted" />
              </button>
            </div>
            <FullChart data={chartData(expanded)} color={expanded.startsWith("BOOM") ? "#22c55e" : "#fb7185"} label={expanded!} />
            {spikes[expanded] && !spikes[expanded]?.error && (
              <div className={`mt-4 p-3 rounded-lg border text-sm ${spikes[expanded].isSpikeImminent ? "border-red-500/40 bg-red-500/10" : "bg-background border-border"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-2">
                    <AlertTriangle size={16} className={spikes[expanded].isSpikeImminent ? "text-danger" : "text-warning"} />
                    Spike Predictor
                  </span>
                  <span className={`font-bold font-mono text-lg ${spikes[expanded].isSpikeImminent ? "text-danger" : spikes[expanded].spikeProbability > 50 ? "text-warning" : "text-success"}`}>
                    {spikes[expanded].spikeProbability}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-surface-light rounded-full mt-2 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${spikes[expanded].spikeProbability}%`, background: spikes[expanded].isSpikeImminent ? "#ef4444" : spikes[expanded].spikeProbability > 50 ? "#f59e0b" : "#22c55e" }} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs text-text-secondary">
                  <div><span className="text-text-muted">Direction </span><span className="font-semibold text-text capitalize">{spikes[expanded].expectedDirection === "up" ? "Hausse ↗" : "Baisse ↘"}</span></div>
                  <div><span className="text-text-muted">Ampleur </span><span className="font-semibold text-text">{spikes[expanded].estimatedMagnitude}</span></div>
                  <div><span className="text-text-muted">Dernier spike </span><span className="font-semibold text-text">il y a {spikes[expanded].timeSinceLastSpike}s</span></div>
                  <div>
                    <span className="text-text-muted">{expanded.startsWith("BOOM") ? "Dernier bas" : "Dernier haut"} </span>
                    <span className="font-semibold text-text font-mono">
                      ${spikes[expanded].referenceLevel?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "—"}
                    </span>
                  </div>
                </div>
                {spikes[expanded].consecutiveMoves !== undefined && (
                  <div className="mt-2 text-[10px] text-text-muted">
                    Mouvements consécutifs opposés : {spikes[expanded].consecutiveMoves}/5 • 
                    Distance du niveau : {spikes[expanded].distancePercent ?? 0}% • 
                    Force S/R : {spikes[expanded].referenceStrength ?? 0} touches
                  </div>
                )}
                {spikes[expanded].sRlevels && spikes[expanded].sRlevels.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[10px] font-semibold text-text-muted uppercase mb-1.5">Niveaux S/R détectés</div>
                    <div className="flex flex-wrap gap-1.5">
                      {spikes[expanded].sRlevels.map((level: SRLevel, i: number) => (
                        <span key={i}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium
                            ${level.type === "support"
                              ? "bg-success/10 text-success border border-success/20"
                              : "bg-danger/10 text-danger border border-danger/20"}`}
                        >
                          <span className={`w-1 h-1 rounded-full ${level.type === "support" ? "bg-success" : "bg-danger"}`} />
                          ${level.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                          <span className="opacity-60">x{level.strength}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
          {INDICES.map((idx) => {
            const key = `${idx.type}_${idx.number}`;
            const price = currentPrice(key);
            const change = currentChange(key);
            const isExpanded = expanded === key;
            const spike = spikes[key];
            const idxConnected = state?.[key]?.connected;

            return (
              <div
                key={key}
                className={`rounded-xl border transition-all cursor-pointer hover:border-primary/30 ${isExpanded ? "border-primary/40 bg-surface" : "bg-surface/50 border-border"}`}
                onClick={() => !isExpanded && state?.[key]?.history?.length > 0 && setExpanded(key)}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {idx.type === "BOOM" ? <Flame size={16} style={{ color: idx.color }} /> : <Droplet size={16} style={{ color: idx.color }} />}
                      <span className="font-semibold text-sm">{idx.label}</span>
                      {idxConnected && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
                    </div>
                    <div className="flex items-center gap-2">
                      {spike?.isSpikeImminent && <AlertTriangle size={14} className="text-danger animate-pulse" />}
                      <span className={`text-xs font-mono ${change >= 0 ? "text-success" : "text-danger"}`}>
                        {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-xl font-bold font-mono mb-2">
                    {price > 0
                      ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : <span className="text-text-muted text-sm">En attente...</span>}
                  </div>
                  {(state?.[key]?.history?.length ?? 0) > 1 ? (
                    <MiniChart data={state[key].history} color={idx.color} />
                  ) : (
                    <div className="h-[60px] flex items-center justify-center text-text-muted text-xs">Données en attente...</div>
                  )}
                  {spike && !spike.error && (
                    <div className="mt-2 flex items-center gap-2 text-[10px]">
                      <div className="flex-1 h-1 rounded-full bg-surface-light overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${spike.spikeProbability}%`, background: spike.isSpikeImminent ? "#ef4444" : "#f59e0b" }} />
                      </div>
                      <span className="font-mono font-semibold" style={{ color: spike.isSpikeImminent ? "#ef4444" : "#f59e0b" }}>{spike.spikeProbability}%</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-surface/50 p-4">
            <h4 className="text-xs font-semibold text-text-muted uppercase mb-2">Boom</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              Les indices <strong className="text-success">Boom</strong> génèrent des spikes à la <strong className="text-success">hausse</strong>. Plus le numéro est bas (500), plus la volatilité est élevée.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface/50 p-4">
            <h4 className="text-xs font-semibold text-text-muted uppercase mb-2">Crash</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              Les indices <strong className="text-danger">Crash</strong> génèrent des spikes à la <strong className="text-danger">baisse</strong>. Le 500 est le plus volatil, le 1000 le plus stable.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface/50 p-4">
            <h4 className="text-xs font-semibold text-text-muted uppercase mb-2">Source</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              Données live via l&apos;API WebSocket Deriv. {appIdMissing ? "Configurez votre DERIV_APP_ID pour activer le flux." : isAnyConnected ? "Connecté et en réception." : "Tentative de connexion..."}
            </p>
          </div>
        </div>

        <p className="text-xs text-text-muted mt-4 text-center">
          API Deriv (WebSocket) • 6 indices synthétiques • Mise à jour chaque seconde
        </p>
      </div>
    </section>
  );
}
