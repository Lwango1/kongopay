import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import DerivChart from "@/components/DerivChart";
import MarketScanner from "@/components/MarketScanner";
import Footer from "@/components/Footer";
import AdBanner from "@/components/AdBanner";

export default function Home() {
  return (
    <div className="min-h-screen md:ml-64 transition-all duration-300">
      <Header />
      <main>
        <Hero />
        <Features />
        <MarketScanner />
        <section className="max-w-5xl mx-auto px-4 py-16">
          <div className="rounded-xl border border-border bg-surface p-8">
            <h2 className="text-2xl font-bold mb-4">Pourquoi choisir KongoPay ?</h2>
            <div className="grid md:grid-cols-2 gap-6 text-sm text-text-secondary">
              <div>
                <h3 className="font-semibold text-text mb-2">Une plateforme adaptée à l&apos;Afrique</h3>
                <p>
                  KongoPay est la première plateforme d&apos;échange de crypto-monnaies conçue spécifiquement
                  pour l&apos;Afrique francophone. Nous supportons les méthodes de paiement locales comme
                  Airtel Money, Orange Money et M-Pesa, et proposons des prix en Francs Congolais (CDF).
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-text mb-2">Trading P2P sécurisé</h3>
                <p>
                  Notre système d&apos;échange peer-to-peer vous permet d&apos;acheter et de vendre des
                  crypto-monnaies directement entre utilisateurs, avec des transactions sécurisées et
                  un service d&apos;escrow intégré pour protéger les deux parties.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-text mb-2">Signaux de trading intelligents</h3>
                <p>
                  Recevez des signaux de trading basés sur l&apos;intelligence artificielle et l&apos;analyse
                  technique avancée. Nos algorithmes analysent les marchés en temps réel pour vous
                  aider à prendre des décisions éclairées.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-text mb-2">Sécurité et conformité</h3>
                <p>
                  Nous appliquons les normes de sécurité les plus strictes : chiffrement AES-256,
                  authentification à deux facteurs, et conformité KYC/AML. Vos fonds et vos données
                  personnelles sont protégés en permanence.
                </p>
              </div>
            </div>
          </div>
        </section>
        <div className="max-w-5xl mx-auto px-4">
          <AdBanner slot="home-banner" format="horizontal" />
        </div>
        <DerivChart />
      </main>
      <Footer />
    </div>
  );
}
