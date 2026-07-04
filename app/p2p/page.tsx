"use client";

import { useEffect, useState } from "react";
import { Plus, X, TrendingUp, TrendingDown, RefreshCw, MessageSquare, MessageCircle } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { cdfToUsdt, formatUsdt } from "@/lib/rates";
import Link from "next/link";

interface P2POffer {
  id: string;
  userId: string;
  type: "buy" | "sell";
  crypto: string;
  fiatAmount: number;
  cryptoAmount: number;
  pricePerUnit: number;
  paymentMethod: string;
  minAmount: number;
  maxAmount: number;
  whatsapp: string;
  telegram: string;
  status: string;
  createdAt: string;
}

const CRYPTOS = ["BTC", "ETH", "SOL", "USDT"];
const PAYMENT_METHODS = ["Airtel Money", "Orange Money", "M-Pesa", "Virement bancaire"];

export default function P2PPage() {
  const { user } = useAuth();
  const [offers, setOffers] = useState<P2POffer[]>([]);
  const [myOffers, setMyOffers] = useState<P2POffer[]>([]);
  const [filterType, setFilterType] = useState<"all" | "buy" | "sell">("all");
  const [filterCrypto, setFilterCrypto] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formType, setFormType] = useState<"buy" | "sell">("sell");
  const [formCrypto, setFormCrypto] = useState("USDT");
  const [formFiat, setFormFiat] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formMethod, setFormMethod] = useState("Airtel Money");
  const [formMin, setFormMin] = useState("");
  const [formMax, setFormMax] = useState("");
  const [formWhatsapp, setFormWhatsapp] = useState("");
  const [formTelegram, setFormTelegram] = useState("");
  const [offerLimit, setOfferLimit] = useState<{ plan: string; remaining: number; max: number } | null>(null);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== "all") params.set("type", filterType);
      if (filterCrypto !== "all") params.set("crypto", filterCrypto);
      const data = await apiFetch<P2POffer[]>(`/p2p/offers?${params}`);
      setOffers(data);
      setError("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyOffers = async () => {
    if (!user) return;
    try {
      const data = await apiFetch<P2POffer[]>("/p2p/my-offers");
      setMyOffers(data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchOffers();
  }, [filterType, filterCrypto]);

  useEffect(() => {
    if (user) {
      fetchMyOffers();
      apiFetch<{ plan: string; remaining: number; max: number }>("/subscription/p2p-usage")
        .then(setOfferLimit)
        .catch(() => {});
    }
  }, [user]);

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cryptoAmount = parseFloat(formFiat) / parseFloat(formPrice);
      await apiFetch("/p2p/offers", {
        method: "POST",
        body: JSON.stringify({
          type: formType,
          crypto: formCrypto,
          fiatAmount: parseFloat(formFiat),
          cryptoAmount,
          pricePerUnit: parseFloat(formPrice),
          paymentMethod: formMethod,
          minAmount: formMin ? parseFloat(formMin) : null,
          maxAmount: formMax ? parseFloat(formMax) : null,
          whatsapp: formWhatsapp || null,
          telegram: formTelegram || null,
        }),
      });
      setShowForm(false);
      setFormFiat("");
      setFormPrice("");
      setFormWhatsapp("");
      setFormTelegram("");
      fetchOffers();
      fetchMyOffers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancelOffer = async (id: string) => {
    try {
      await apiFetch(`/p2p/offers/${id}`, { method: "DELETE" });
      fetchMyOffers();
      fetchOffers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredOffers = offers.filter((o) => {
    if (filterType !== "all" && o.type !== filterType) return false;
    if (filterCrypto !== "all" && o.crypto !== filterCrypto) return false;
    return true;
  });

  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen">
        <section className="max-w-5xl mx-auto px-4 py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold">Trading P2P</h1>
              <p className="text-text-secondary mt-2">
                Achetez et vendez des cryptos directement entre utilisateurs
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/p2p/trades"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text hover:bg-surface transition-colors text-sm font-medium">
                <MessageSquare size={16} /> Transactions
              </Link>
              <Link href="/p2p/conversations"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text hover:bg-surface transition-colors text-sm font-medium">
                <MessageCircle size={16} /> Discussions
              </Link>
              <button onClick={fetchOffers} className="p-2 rounded-lg border border-border hover:bg-surface transition-colors">
                <RefreshCw size={18} className="text-text-muted" />
              </button>
              {user && (
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  <Plus size={16} /> Publier une annonce
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl border border-danger/30 bg-danger/10 text-danger text-sm">
              {error}
            </div>
          )}

          {user && offerLimit && (
            <div className="mb-6 px-4 py-2.5 rounded-xl bg-surface border border-border text-sm flex items-center justify-between">
              <span className="text-text-secondary">
                {offerLimit.plan === "premium" || offerLimit.plan === "admin"
                  ? "Annonces illimitées"
                  : `Annonces gratuites : ${offerLimit.remaining} / ${offerLimit.max} restantes`}
              </span>
              {offerLimit.plan !== "premium" && offerLimit.plan !== "admin" && (
                <a href="/abonnement" className="text-primary hover:underline text-xs font-medium">
                  Passer Premium
                </a>
              )}
            </div>
          )}

          {showForm && (
            <div className="rounded-xl border border-border bg-surface p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Nouvelle annonce</h2>
                <button onClick={() => setShowForm(false)} className="p-1 hover:bg-surface-light rounded transition-colors">
                  <X size={18} className="text-text-muted" />
                </button>
              </div>
              <form onSubmit={handleCreateOffer} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Type</label>
                  <select value={formType} onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-primary">
                    <option value="sell">Je vends</option>
                    <option value="buy">J&apos;achète</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Crypto</label>
                  <select value={formCrypto} onChange={(e) => setFormCrypto(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-primary">
                    {CRYPTOS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Montant (CDF)</label>
                  <input type="number" value={formFiat} onChange={(e) => setFormFiat(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-text outline-none focus:border-primary"
                    placeholder="500000" required />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Prix unitaire (CDF)</label>
                  <input type="number" value={formPrice} onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-text outline-none focus:border-primary"
                    placeholder="2700" required />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Paiement</label>
                  <select value={formMethod} onChange={(e) => setFormMethod(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-primary">
                    {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-text-muted mb-1 block">Min (CDF)</label>
                    <input type="number" value={formMin} onChange={(e) => setFormMin(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-text outline-none focus:border-primary"
                      placeholder="50000" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-text-muted mb-1 block">Max (CDF)</label>
                    <input type="number" value={formMax} onChange={(e) => setFormMax(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-text outline-none focus:border-primary"
                      placeholder={formFiat || "500000"} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">WhatsApp (pour contact direct)</label>
                  <input type="text" value={formWhatsapp} onChange={(e) => setFormWhatsapp(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-primary"
                    placeholder="+243XXXXXXXXX" />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Telegram (pseudo)</label>
                  <input type="text" value={formTelegram} onChange={(e) => setFormTelegram(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-primary"
                    placeholder="@username" />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <button type="submit"
                    className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors">
                    Publier l&apos;annonce
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(["all", "buy", "sell"] as const).map((t) => (
                <button key={t} onClick={() => setFilterType(t)}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${filterType === t ? "bg-primary text-white" : "bg-surface text-text-secondary hover:text-text"}`}>
                  {t === "all" ? "Toutes" : t === "buy" ? "Achats" : "Ventes"}
                </button>
              ))}
            </div>
            <select value={filterCrypto} onChange={(e) => setFilterCrypto(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text outline-none focus:border-primary">
              <option value="all">Toutes les cryptos</option>
              {CRYPTOS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-surface-light animate-pulse" />
              ))}
            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-12 text-center">
              <p className="text-text-muted mb-2">Aucune annonce active</p>
              {user && (
                <button onClick={() => setShowForm(true)}
                  className="text-primary hover:underline text-sm">Publier une annonce</button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOffers.map((offer) => (
                <div key={offer.id}
                  className="rounded-xl border border-border bg-surface/50 hover:bg-surface transition-colors p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${offer.type === "sell" ? "bg-danger/20" : "bg-success/20"}`}>
                        {offer.type === "sell" ? <TrendingUp size={18} className="text-danger" /> : <TrendingDown size={18} className="text-success" />}
                      </div>
                      <div>
                        <span className={`font-semibold ${offer.type === "sell" ? "text-danger" : "text-success"}`}>
                          {offer.type === "sell" ? "Vente" : "Achat"}
                        </span>
                        <span className="text-text-muted mx-2">•</span>
                        <span className="font-semibold">{offer.crypto}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold font-mono">{offer.fiatAmount.toLocaleString()} CDF</div>
                      <div className="text-[10px] text-text-muted">
                        ≈ {formatUsdt(cdfToUsdt(offer.fiatAmount))}
                      </div>
                      <div className="text-xs text-text-muted mt-0.5">
                        {offer.cryptoAmount.toFixed(4)} {offer.crypto} à {offer.pricePerUnit.toLocaleString()} CDF
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4 text-text-secondary">
                      <span>{offer.paymentMethod}</span>
                      <span>Min: {offer.minAmount.toLocaleString()} CDF</span>
                      <span>Max: {offer.maxAmount.toLocaleString()} CDF</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">
                        {new Date(offer.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>

                  {user && offer.userId !== user.uid && offer.status === "active" && (
                    <div className="mt-3 pt-3 border-t border-border flex gap-2">
                      {offer.whatsapp ? (
                        <a href={`https://wa.me/${offer.whatsapp.replace(/[^0-9]/g, '')}?text=Bonjour%2C%20je%20suis%20int%C3%A9ress%C3%A9%20par%20votre%20annonce%20${offer.id}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex-1 py-2 rounded-lg bg-[#25D366] text-white hover:bg-[#20BD5A] transition-colors text-sm font-medium flex items-center justify-center gap-1.5">
                          <MessageCircle size={16} /> WhatsApp
                        </a>
                      ) : null}
                      {offer.telegram ? (
                        <a href={`https://t.me/${offer.telegram.replace('@', '')}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex-1 py-2 rounded-lg bg-[#0088cc] text-white hover:bg-[#0077b5] transition-colors text-sm font-medium flex items-center justify-center gap-1.5">
                          <MessageCircle size={16} /> Telegram
                        </a>
                      ) : null}
                      {!offer.whatsapp && !offer.telegram && (
                        <span className="w-full py-2 rounded-lg border border-border text-text-muted text-sm text-center">
                          Aucun contact disponible
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {myOffers.length > 0 && (
            <div className="mt-12">
              <h2 className="text-xl font-bold mb-4">Mes annonces</h2>
              <div className="space-y-3">
                {myOffers.map((offer) => (
                  <div key={offer.id}
                    className="rounded-xl border border-border bg-surface/50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-semibold ${offer.type === "sell" ? "text-danger" : "text-success"}`}>
                          {offer.type === "sell" ? "Vente" : "Achat"} {offer.crypto}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${offer.status === "active" ? "bg-success/20 text-success" : "bg-text-muted/20 text-text-muted"}`}>
                          {offer.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono">{offer.fiatAmount.toLocaleString()} CDF</span>
                        {offer.status === "active" && (
                          <button onClick={() => handleCancelOffer(offer.id)}
                            className="text-xs text-danger hover:underline">Annuler</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
