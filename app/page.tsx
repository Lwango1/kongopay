import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import { TrendingUp, Users, Wallet, BarChart3, MessageCircle, Shield } from "lucide-react";

const STEPS = [
  { icon: Users, title: "Signaux Trading", desc: "Recevez des alertes en temps réel sur les indices synthétiques BOOM/CRASH avec analyse S/R, squeeze et confluence multi-timeframe.", href: "/signaux" },
  { icon: Wallet, title: "Calendrier Économique", desc: "Anticipez les mouvements du marché avec les annonces économiques réelles (Finnhub + ForexFactory). Signaux pré et post-annonce.", href: "/signaux" },
  { icon: TrendingUp, title: "Trading P2P", desc: "Achetez et vendez des cryptos directement entre utilisateurs. Paiement via Airtel Money, Orange Money et M-Pesa.", href: "/p2p" },
  { icon: MessageCircle, title: "Support Mobile Money", desc: "Déposez et retirez des fonds en Francs Congolais (CDF) via les méthodes de paiement locales africaines.", href: "/portefeuille" },
  { icon: BarChart3, title: "Abonnement Premium", desc: "Débloquez des signaux illimités et des annonces P2P sans limite pour 7 000 CDF/mois.", href: "/abonnement" },
  { icon: Shield, title: "Sécurisé & Transparent", desc: "Transactions sécurisées par escrow, KYC intégré, et conformité réglementaire en RDC.", href: "/a-propos" },
];

export default function Home() {
  return (
    <div className="min-h-screen md:ml-64 transition-all duration-300">
      <Header />
      <main>
        <Hero />
        <Features />

        <section className="py-20 px-4 border-t border-border">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-text-secondary text-center max-w-2xl mx-auto mb-12">
              Une plateforme complète pour trader, échanger et gérer vos crypto-monnaies en Afrique.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {STEPS.map((s) => (
                <a key={s.title} href={s.href}
                  className="group p-6 rounded-xl border border-border bg-surface/50 hover:bg-surface transition-all hover:border-primary/30"
                >
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <s.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{s.desc}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-4 border-t border-border bg-surface/30">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Prêt à commencer ?</h2>
            <p className="text-text-secondary text-lg mb-8 max-w-xl mx-auto">
              Créez un compte gratuit et accédez à tous les outils de trading, signaux en temps réel et échanges P2P.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/inscription" className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl font-semibold text-lg transition-all hover:scale-105">
                Créer un compte gratuit
              </a>
              <a href="/signaux" className="border border-border hover:bg-surface text-text px-8 py-3 rounded-xl font-semibold text-lg transition-all">
                Voir les signaux
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
