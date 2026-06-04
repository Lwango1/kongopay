"use client";

import { useState } from "react";
import { Bell, Plus, X } from "lucide-react";

const PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"];

export default function PriceAlert() {
  const [alerts, setAlerts] = useState<{ pair: string; target: number; direction: "above" | "below" }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [pair, setPair] = useState("BTC/USDT");
  const [target, setTarget] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");

  const addAlert = () => {
    if (!target) return;
    setAlerts([...alerts, { pair, target: parseFloat(target), direction }]);
    setTarget("");
    setShowForm(false);
  };

  const removeAlert = (i: number) => setAlerts(alerts.filter((_, idx) => idx !== i));

  return (
    <section className="py-20 px-4 border-t border-border">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 flex items-center justify-center gap-3">
          <Bell className="text-primary" size={32} />
          Alertes de Prix
        </h2>
        <p className="text-text-secondary text-center mb-8">Soyez notifié quand le prix atteint votre objectif</p>

        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-text-muted">{alerts.length} active{alerts.length > 1 ? "s" : ""}</span>
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 text-sm bg-primary/20 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/30 transition-colors">
              <Plus size={16} /> Ajouter
            </button>
          </div>

          {showForm && (
            <div className="p-4 rounded-lg bg-background border border-border mb-4 space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <select value={pair} onChange={e => setPair(e.target.value)}
                  className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-primary">
                  {PAIRS.map(p => <option key={p}>{p}</option>)}
                </select>
                <select value={direction} onChange={e => setDirection(e.target.value as any)}
                  className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-primary">
                  <option value="above">Au-dessus de</option>
                  <option value="below">En-dessous de</option>
                </select>
                <input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="Prix cible"
                  className="bg-surface border border-border rounded-lg px-3 py-2 text-sm font-mono text-text outline-none focus:border-primary" />
              </div>
              <button onClick={addAlert}
                className="w-full py-2 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary/90 transition-colors">
                Créer l&apos;alerte
              </button>
            </div>
          )}

          {alerts.length === 0 && !showForm && (
            <div className="text-center py-8 text-text-muted text-sm">
              Aucune alerte. Cliquez sur &quot;Ajouter&quot; pour en créer une.
            </div>
          )}

          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{a.pair[0]}</div>
                  <span className="text-sm font-medium">{a.pair}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.direction === "above" ? "bg-success/20 text-success" : "bg-danger/20 text-danger"}`}>
                    {a.direction === "above" ? "≥" : "≤"} ${a.target.toLocaleString()}
                  </span>
                </div>
                <button onClick={() => removeAlert(i)} className="p-1 hover:bg-surface-light rounded transition-colors">
                  <X size={14} className="text-text-muted" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
