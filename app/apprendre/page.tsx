import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MarioCryptoTreasure from "@/components/MarioCryptoTreasure";

const GUIDES = [
  { title: "Qu'est-ce que la Crypto ?", desc: "Comprenez les bases de la blockchain, du Bitcoin et des altcoins." },
  { title: "Sécurité & Stockage", desc: "Protégez vos actifs avec les wallets, le stockage à froid et le 2FA." },
  { title: "Analyser le Marché", desc: "Apprenez à lire les graphiques, les bougies et les indicateurs techniques." },
  { title: "Staking & Earn", desc: "Faites fructifier vos cryptos avec le staking, l'épargne et la DeFi." },
  { title: "La Blockchain", desc: "Comment fonctionne la technologie décentralisée et ses applications." },
  { title: "Glossaire Crypto", desc: "Tous les termes essentiels expliqués simplement." },
];

export default function ApprendrePage() {
  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen px-4">
        <section className="max-w-5xl mx-auto py-16">
          <h1 className="text-4xl font-bold text-center mb-4">Apprendre la Crypto</h1>
          <p className="text-text-secondary text-center mb-12 max-w-2xl mx-auto">
            Des ressources éducatives pour débuter et progresser dans l&apos;univers des cryptomonnaies.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {GUIDES.map((g) => (
              <div key={g.title} className="rounded-xl border border-border bg-surface p-6 hover:border-primary/30 transition-colors cursor-pointer">
                <h3 className="font-semibold mb-2">{g.title}</h3>
                <p className="text-sm text-text-secondary">{g.desc}</p>
              </div>
            ))}
          </div>
        </section>
        <MarioCryptoTreasure />
      </main>
      <Footer />
    </>
  );
}
