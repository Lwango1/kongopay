"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, Signal, Users, Check, Loader2, Wallet, Zap, Coins } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatCdfWithUsdt, formatUsdt } from "@/lib/rates";

interface Plan {
  name: string;
  priceCdf: number;
  priceUsd?: number;
  signalsPerDay: number;
  maxP2POffers: number;
  durationDays?: number;
}

interface SubscriptionStatus {
  plan: string;
  isPremium: boolean;
  premiumUntil: string | null;
  trialEndsAt: string;
}

interface WalletData {
  balanceCdf: number;
}

export default function AbonnementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<{ free: Plan; premium: Plan } | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/connexion"); return; }

    const defaultPlans = {
      free: { name: "Gratuit", priceCdf: 0, signalsPerDay: 4, maxP2POffers: 2 },
      premium: { name: "Premium", priceCdf: 7000, priceUsd: 2.7, signalsPerDay: -1, maxP2POffers: -1, durationDays: 30 },
    };

    const load = async () => {
      try {
        const results = await Promise.allSettled([
          apiFetch<{ free: Plan; premium: Plan }>("/subscription/plans"),
          apiFetch<SubscriptionStatus>("/subscription/status"),
          apiFetch<WalletData>("/wallet/balance"),
        ]);
        if (results[0].status === "fulfilled") setPlans(results[0].value);
        else setPlans(defaultPlans);
        if (results[1].status === "fulfilled") setStatus(results[1].value);
        if (results[2].status === "fulfilled") setWallet(results[2].value);
      } catch {
        setPlans(defaultPlans);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, authLoading, router]);

  const handleSubscribe = async () => {
    setSubscribing(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch<{ message: string; premiumUntil: string }>("/subscription/subscribe", { method: "POST" });
      setSuccess(result.message);
      const [statusData, walletData] = await Promise.all([
        apiFetch<SubscriptionStatus>("/subscription/status"),
        apiFetch<WalletData>("/wallet/balance"),
      ]);
      setStatus(statusData);
      setWallet(walletData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubscribing(false);
    }
  };

  const isPremiumActive = status?.isPremium && status?.premiumUntil && new Date(status.premiumUntil) > new Date();

  if (loading) {
    return (
      <>
        <Header />
        <main className="pt-24 min-h-screen flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-primary" />
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen">
        <section className="max-w-4xl mx-auto px-4 py-16">

          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-3">Abonnement</h1>
            <p className="text-text-secondary max-w-xl mx-auto">
              Débloque toutes les fonctionnalités de KongoPay avec un abonnement Premium.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl border border-danger/30 bg-danger/10 text-danger text-sm text-center max-w-lg mx-auto">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-xl border border-success/30 bg-success/10 text-success text-sm text-center max-w-lg mx-auto">
              {success}
            </div>
          )}

          {isPremiumActive && (
            <div className="mb-8 p-4 rounded-xl border border-success/30 bg-success/5 text-center max-w-lg mx-auto">
              <Crown size={24} className="mx-auto text-warning mb-2" />
              <p className="font-semibold text-success">Premium actif</p>
              <p className="text-xs text-text-muted mt-1">
                Expire le {new Date(status!.premiumUntil!).toLocaleDateString("fr-FR")}
              </p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Free Plan */}
            <div className="rounded-xl border border-border bg-surface p-6 flex flex-col">
              <div className="mb-4">
                <h2 className="text-xl font-bold">Gratuit</h2>
                <div className="text-3xl font-bold mt-2">Gratuit</div>
              </div>
              <ul className="space-y-3 flex-1 mb-6">
                <li className="flex items-start gap-2 text-sm">
                  <Check size={16} className="text-success mt-0.5 shrink-0" />
                  <span className="text-text-secondary">{plans?.free.signalsPerDay} signaux / jour</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check size={16} className="text-success mt-0.5 shrink-0" />
                  <span className="text-text-secondary">Jusqu&apos;à {plans?.free.maxP2POffers} annonces P2P actives</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check size={16} className="text-success mt-0.5 shrink-0" />
                  <span className="text-text-secondary">Accès au marché P2P</span>
                </li>
              </ul>
              {!isPremiumActive && (
                <div className="py-2.5 rounded-lg bg-background border border-border text-text-muted text-sm font-medium text-center">
                  Actuel
                </div>
              )}
            </div>

            {/* Premium Plan */}
            <div className="rounded-xl border-2 border-primary/40 bg-surface p-6 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-semibold px-4 py-1 rounded-full">
                Populaire
              </div>
              <div className="mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Crown size={20} className="text-warning" /> Premium
                </h2>
                <div className="text-3xl font-bold mt-2">
                  {plans?.premium.priceCdf.toLocaleString()} CDF
                </div>
                <p className="text-xs text-text-muted mt-1">
                  {formatUsdt((plans?.premium.priceCdf || 0) / 2600)} / mois
                </p>
              </div>
              <ul className="space-y-3 flex-1 mb-6">
                <li className="flex items-start gap-2 text-sm">
                  <Zap size={16} className="text-warning mt-0.5 shrink-0" />
                  <span className="text-text font-medium">Signaux illimités</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Zap size={16} className="text-warning mt-0.5 shrink-0" />
                  <span className="text-text font-medium">Annonces P2P illimitées</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check size={16} className="text-success mt-0.5 shrink-0" />
                  <span className="text-text-secondary">Accès anticipé aux nouvelles fonctionnalités</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check size={16} className="text-success mt-0.5 shrink-0" />
                  <span className="text-text-secondary">Support prioritaire</span>
                </li>
              </ul>
              {isPremiumActive ? (
                <div className="py-2.5 rounded-lg bg-success/20 text-success text-sm font-medium text-center">
                  Actif
                </div>
              ) : (
                <button onClick={handleSubscribe} disabled={subscribing || !wallet || wallet.balanceCdf < (plans?.premium.priceCdf || 0)}
                  className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                  {subscribing ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
                  {subscribing ? "Traitement..." : "S'abonner"}
                </button>
              )}
              {wallet && !isPremiumActive && (
                <p className="text-xs text-text-muted text-center mt-2">
                  Solde: {wallet.balanceCdf.toLocaleString()} CDF
                  <span className="block text-[10px] opacity-70">
                    ≈ {formatUsdt(wallet.balanceCdf / 2600)}
                  </span>
                  {wallet.balanceCdf < (plans?.premium.priceCdf || 0) && (
                    <span className="text-danger block mt-1">
                      Solde insuffisant. <a href="/portefeuille" className="underline">Approvisionnez votre compte</a>
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="mt-12 grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="rounded-xl border border-border bg-surface/50 p-5">
              <div className="flex items-center gap-3 mb-3">
                <Signal size={20} className="text-primary" />
                <h3 className="font-semibold">Signaux de trading</h3>
              </div>
              <p className="text-xs text-text-secondary">
                {isPremiumActive
                  ? "Vous avez accès à des signaux de trading illimités."
                  : `Vous avez droit à ${plans?.free.signalsPerDay} signaux gratuits par jour. Passez Premium pour des signaux illimités.`}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface/50 p-5">
              <div className="flex items-center gap-3 mb-3">
                <Users size={20} className="text-primary" />
                <h3 className="font-semibold">Annonces P2P</h3>
              </div>
              <p className="text-xs text-text-secondary">
                {isPremiumActive
                  ? "Vous pouvez publier un nombre illimité d'annonces P2P."
                  : `Vous pouvez avoir jusqu'à ${plans?.free.maxP2POffers} annonces actives gratuitement.`}
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
