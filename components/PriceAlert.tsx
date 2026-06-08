"use client";

import { useEffect, useState } from "react";
import { Bell, Plus, X, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

interface Alert {
  id: string;
  pair: string;
  targetPrice: number;
  direction: "above" | "below";
  status: string;
}

const PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"];

export default function PriceAlert() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [pair, setPair] = useState("BTC/USDT");
  const [target, setTarget] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAlerts = async () => {
    if (!user) { setLoading(false); return; }
    try {
      const data = await apiFetch<Alert[]>("/notifications/alerts");
      setAlerts(data);
    } catch { /* not critical */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchAlerts();
  }, [user]);

  const addAlert = async () => {
    if (!target) return;
    try {
      await apiFetch("/notifications/alerts", {
        method: "POST",
        body: JSON.stringify({ pair, targetPrice: parseFloat(target), direction }),
      });
      setTarget("");
      setShowForm(false);
      fetchAlerts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const removeAlert = async (id: string) => {
    try {
      await apiFetch(`/notifications/alerts/${id}`, { method: "DELETE" });
      fetchAlerts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <section className="py-20 px-4 border-t border-border">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 flex items-center justify-center gap-3">
          <Bell className="text-primary" size={32} />
          Alertes de Prix
        </h2>
        <p className="text-text-secondary text-center mb-8">Soyez notifié quand le prix atteint votre objectif</p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-text-muted">
              {loading ? "..." : `${alerts.length} active${alerts.length > 1 ? "s" : ""}`}
            </span>
            {user && (
              <button onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-1.5 text-sm bg-primary/20 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/30 transition-colors">
                <Plus size={16} /> Ajouter
              </button>
            )}
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

          {!user && (
            <div className="text-center py-8 text-text-muted text-sm">
              <a href="/connexion" className="text-primary hover:underline">Connectez-vous</a> pour créer des alertes de prix.
            </div>
          )}

          {user && alerts.length === 0 && !showForm && (
            <div className="text-center py-8 text-text-muted text-sm">
              Aucune alerte. Cliquez sur &quot;Ajouter&quot; pour en créer une.
            </div>
          )}

          <div className="space-y-2">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{a.pair[0]}</div>
                  <span className="text-sm font-medium">{a.pair}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.direction === "above" ? "bg-success/20 text-success" : "bg-danger/20 text-danger"}`}>
                    {a.direction === "above" ? "≥" : "≤"} ${a.targetPrice.toLocaleString()}
                  </span>
                  <span className={`text-xs ${a.status === "triggered" ? "text-warning" : "text-text-muted"}`}>
                    {a.status}
                  </span>
                </div>
                <button onClick={() => removeAlert(a.id)} className="p-1 hover:bg-surface-light rounded transition-colors">
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
