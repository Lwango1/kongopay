"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Ticker {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
}

const COLORS: Record<string, string> = {
  BTC: "#f7931a", ETH: "#627eea", SOL: "#9945ff",
  BNB: "#f3ba2f", XRP: "#00aae4", ADA: "#0033ad",
};

const TABS = ["Tous", "Crypto", "Forex", "Matières Premières"];

export default function MarketOverview() {
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [tab, setTab] = useState("Tous");

  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const res = await fetch("/api/trading/ticker");
        if (res.ok) {
          const data = await res.json();
          setTickers(Array.isArray(data) ? data : [data]);
        }
      } catch { /* fallback */ }
    };
    fetchTickers();
    const interval = setInterval(fetchTickers, 10000);
    return () => clearInterval(interval);
  }, []);

  const filtered = tab === "Tous" ? tickers : tickers;

  return (
    <section className="py-20 px-4 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold">Marchés en temps réel</h2>
            <p className="text-text-secondary mt-2">Cryptos, Forex, Matières Premières — Données multi-sources</p>
          </div>
          <a href="/marches" className="hidden sm:block text-sm text-primary hover:text-primary-light transition-colors">Voir tous les marchés →</a>
        </div>
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-sm transition-all ${tab === t ? "bg-primary text-white" : "bg-surface text-text-secondary hover:text-text"}`}>{t}</button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-muted border-b border-border">
                <th className="text-left py-3 px-2 font-medium">#</th>
                <th className="text-left py-3 px-2 font-medium">Nom</th>
                <th className="text-right py-3 px-2 font-medium">Prix</th>
                <th className="text-right py-3 px-2 font-medium">24h %</th>
                <th className="text-right py-3 px-2 font-medium hidden md:table-cell">Volume</th>
                <th className="text-right py-3 px-2 font-medium hidden md:table-cell">Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-text-muted">Chargement des marchés...</td></tr>
              ) : filtered.map((m, i) => {
                const sym = m.symbol.replace("/", "");
                const base = m.symbol.split("/")[0];
                return (
                  <tr key={m.symbol} className="border-b border-border hover:bg-surface/50 transition-colors cursor-pointer">
                    <td className="py-3 px-2 text-text-muted">{i + 1}</td>
                    <td className="py-3 px-2 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${COLORS[base] || "#7c3aed"}20`, color: COLORS[base] || "#7c3aed" }}>{base[0]}</div>
                      <span className="font-medium">{m.symbol}</span>
                    </td>
                    <td className="py-3 px-2 text-right font-mono">${m.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className={`py-3 px-2 text-right font-mono ${(m.change24h ?? 0) >= 0 ? "text-success" : "text-danger"}`}>
                      <span className="flex items-center justify-end gap-1">
                        {(m.change24h ?? 0) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {(m.change24h ?? 0) >= 0 ? "+" : ""}{(m.change24h ?? 0).toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right text-text-secondary hidden md:table-cell">
                      {(m.volume24h ?? 0) > 1000 ? `${(m.volume24h / 1000).toFixed(1)}K` : (m.volume24h ?? 0).toFixed(1)} USDT
                    </td>
                    <td className="py-3 px-2 text-right hidden md:table-cell">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-surface-light text-text-muted">Binance</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {tickers.length === 0 && (
          <div className="rounded-xl border border-border bg-surface p-6 mt-4">
            <div className="grid grid-cols-3 gap-4">
              {["BTC/USDT", "ETH/USDT", "SOL/USDT"].map((s) => (
                <div key={s} className="animate-pulse">
                  <div className="h-4 bg-surface-light rounded w-20 mb-2" />
                  <div className="h-6 bg-surface-light rounded w-28 mb-1" />
                  <div className="h-3 bg-surface-light rounded w-16" />
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-text-muted mt-4">
          {tickers.length} paires suivies • Cryptos (Binance) • Forex (Open Exchange) • Matières premières (Metals.live)
        </p>
      </div>
    </section>
  );
}
