import { TrendingUp, TrendingDown } from "lucide-react";

export default function TradingMockup() {
  return (
    <section className="py-20 px-4 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Interface de Trading Pro</h2>
          <p className="text-text-secondary max-w-2xl mx-auto">
            Graphiques avancés, profondeur de marché en temps réel et exécution ultra-rapide.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-surface-light/50">
            <span className="text-sm font-semibold text-success flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-success" />
              BTC/USDT
            </span>
            <span className="text-lg font-bold font-mono">$98,245.00</span>
            <span className="text-sm text-success flex items-center gap-1"><TrendingUp size={14} /> +2.14%</span>
            <span className="text-xs text-text-muted ml-auto">Vol: 42.5B USDT</span>
          </div>
          <div className="grid lg:grid-cols-3 gap-0">
            <div className="lg:col-span-2 p-4 border-r border-border">
              <div className="h-64 rounded-lg bg-gradient-to-b from-surface-light/30 to-background flex items-center justify-center border border-border/50">
                <div className="text-center">
                  <div className="flex items-end gap-1 h-32 justify-center mb-4">
                    {[40, 55, 35, 70, 45, 60, 50, 75, 55, 65, 48, 80, 58, 72, 62, 85, 68, 78, 55, 70].map((h, i) => (
                      <div key={i} className={`w-3 rounded-t-sm ${i > 12 ? "bg-success/60" : Math.random() > 0.5 ? "bg-success/40" : "bg-danger/40"}`} style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  <span className="text-xs text-text-muted">Graphique en chandeliers — BTC/USDT</span>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex gap-2">
                <button className="flex-1 py-2 rounded-lg bg-success/20 text-success text-sm font-semibold hover:bg-success/30 transition-colors border border-success/30">Acheter</button>
                <button className="flex-1 py-2 rounded-lg bg-danger/20 text-danger text-sm font-semibold hover:bg-danger/30 transition-colors border border-danger/30">Vendre</button>
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Prix (USDT)</label>
                <input type="text" defaultValue="98245.00" readOnly className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-text outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Quantité (BTC)</label>
                <input type="text" placeholder="0.00" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-text outline-none focus:border-primary" />
              </div>
              <div className="flex gap-1">
                {["25%", "50%", "75%", "100%"].map((p) => (
                  <button key={p} className="flex-1 py-1 text-xs border border-border rounded hover:bg-surface-light transition-colors text-text-muted">{p}</button>
                ))}
              </div>
              <button className="w-full py-2.5 rounded-lg bg-gradient-to-r from-success to-success/80 text-white font-semibold text-sm hover:opacity-90 transition-opacity">
                Acheter BTC
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
