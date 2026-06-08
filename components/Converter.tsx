"use client";

import { useEffect, useState } from "react";
import { ArrowDownUp } from "lucide-react";
import { getAllTickers } from "@/lib/binance";

const COINS = ["BTC", "ETH", "SOL", "BNB", "USDT"];

export default function Converter() {
  const [from, setFrom] = useState("BTC");
  const [to, setTo] = useState("USDT");
  const [amount, setAmount] = useState("1");
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const tickers = await getAllTickers();
        const rateMap: Record<string, number> = {};
        for (const t of tickers) {
          const base = t.symbol.split("/")[0];
          rateMap[`${base}_USDT`] = t.price;
        }
        setRates(rateMap);
      } catch {
        // Keep defaults on error
      } finally {
        setLoading(false);
      }
    };
    fetchRates();
    const interval = setInterval(fetchRates, 30000);
    return () => clearInterval(interval);
  }, []);

  const getRate = (a: string, b: string): number => {
    if (a === b) return 1;
    if (a === "USDT") return 1 / (rates[`${b}_USDT`] || 1);
    if (b === "USDT") return rates[`${a}_USDT`] || 0;
    const aUsdt = rates[`${a}_USDT`] || 0;
    const bUsdt = rates[`${b}_USDT`] || 1;
    return aUsdt / bUsdt;
  };

  const rate = getRate(from, to);
  const result = amount ? (parseFloat(amount) * rate).toLocaleString(undefined, { maximumFractionDigits: 6 }) : "—";

  return (
    <section className="py-20 px-4 border-t border-border">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Convertisseur Crypto</h2>
        <p className="text-text-secondary text-center mb-8">Convertissez instantanément entre les cryptos et les devises.</p>
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="grid sm:grid-cols-5 gap-4 items-end">
            <div className="sm:col-span-2">
              <label className="text-xs text-text-muted mb-1 block">Montant</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-text outline-none focus:border-primary" />
            </div>
            <div className="sm:col-span-1">
              <label className="text-xs text-text-muted mb-1 block">De</label>
              <select value={from} onChange={e => setFrom(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary appearance-none cursor-pointer">
                {COINS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="sm:col-span-1 flex justify-center">
              <button onClick={() => { setFrom(to); setTo(from); }} className="p-2 rounded-full border border-border hover:bg-surface-light transition-colors mt-5">
                <ArrowDownUp size={18} className="text-primary" />
              </button>
            </div>
            <div className="sm:col-span-1">
              <label className="text-xs text-text-muted mb-1 block">Vers</label>
              <select value={to} onChange={e => setTo(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary appearance-none cursor-pointer">
                {COINS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-6 p-4 rounded-lg bg-background border border-border">
            <div className="text-xs text-text-muted mb-1">
              Résultat {loading && "(taux en direct...)"}
            </div>
            <div className="text-2xl font-bold font-mono">{result} {to}</div>
            <div className="text-xs text-text-muted mt-1">
              1 {from} = {rate.toLocaleString()} {to}
              {loading && <span className="ml-2 animate-pulse">⏳</span>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
