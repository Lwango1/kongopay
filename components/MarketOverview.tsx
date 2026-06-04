"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Star } from "lucide-react";

const MARKETS = [
  { pair: "BTC/USDT", price: 98245.00, change: 2.14, vol: "42.5B", cat: "Crypto", color: "#f7931a" },
  { pair: "ETH/USDT", price: 3842.50, change: 3.42, vol: "28.1B", cat: "Crypto", color: "#627eea" },
  { pair: "SOL/USDT", price: 187.45, change: 5.81, vol: "12.3B", cat: "Crypto", color: "#9945ff" },
  { pair: "BNB/USDT", price: 612.80, change: -0.85, vol: "8.7B", cat: "Crypto", color: "#f3ba2f" },
  { pair: "XRP/USDT", price: 2.45, change: -1.23, vol: "6.2B", cat: "Crypto", color: "#00aae4" },
  { pair: "ADA/USDT", price: 0.62, change: 4.15, vol: "3.8B", cat: "Crypto", color: "#0033ad" },
  { pair: "EUR/USD", price: 1.0845, change: 0.12, vol: "-,", cat: "Forex", color: "#60a5fa" },
  { pair: "XAU/USD", price: 2338.20, change: -0.45, vol: "-,", cat: "Matières", color: "#f59e0b" },
];

const TABS = ["Tous", "Crypto", "Forex", "Matières Premières"];

export default function MarketOverview() {
  const [tab, setTab] = useState("Tous");
  const filtered = tab === "Tous" ? MARKETS : MARKETS.filter(m => 
    tab === "Matières Premières" ? m.cat === "Matières" : m.cat === tab
  );

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
              className={`px-4 py-1.5 rounded-full text-sm transition-all ${tab === t ? "bg-primary text-white" : "bg-surface text-text-secondary hover:text-text"}`}
            >{t}</button>
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
                <th className="text-right py-3 px-2 font-medium hidden md:table-cell">Catégorie</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={m.pair} className="border-b border-border hover:bg-surface/50 transition-colors cursor-pointer">
                  <td className="py-3 px-2 text-text-muted">{i + 1}</td>
                  <td className="py-3 px-2 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${m.color}20`, color: m.color }}>{m.pair[0]}</div>
                    <span className="font-medium">{m.pair}</span>
                  </td>
                  <td className="py-3 px-2 text-right font-mono">${m.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className={`py-3 px-2 text-right font-mono ${m.change >= 0 ? "text-success" : "text-danger"}`}>
                    <span className="flex items-center justify-end gap-1">
                      {m.change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {m.change >= 0 ? "+" : ""}{m.change}%
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right text-text-secondary hidden md:table-cell">{m.vol}</td>
                  <td className="py-3 px-2 text-right hidden md:table-cell">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-surface-light text-text-muted">{m.cat}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-muted mt-4">
          0 paires suivies • Cryptos (Binance) • Forex (Open Exchange) • Matières premières (Metals.live)
        </p>
      </div>
    </section>
  );
}
