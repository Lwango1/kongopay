import Header from "@/components/Header";
import Footer from "@/components/Footer";

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

        <section className="max-w-5xl mx-auto pb-8">
          <h2 className="text-2xl font-bold text-center mb-2">🎮 Jeux du Moment</h2>
          <p className="text-text-secondary text-center mb-8 max-w-2xl mx-auto">
            Les jeux qui repoussent les limites techniques et visuelles sur console.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-border bg-surface overflow-hidden hover:border-primary/30 transition-all">
              <div className="h-36 bg-gradient-to-br from-teal-500/20 via-cyan-500/10 to-emerald-500/20 flex items-center justify-center border-b border-border">
                <span className="text-6xl">🤖</span>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg mb-2">Horizon Forbidden West</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Visuellement, c&apos;est l&apos;un des plus beaux jeux toutes consoles confondues. La modélisation des visages, la végétation dense, l&apos;eau et les détails des machines biomécaniques sont hallucinants.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface overflow-hidden hover:border-primary/30 transition-all">
              <div className="h-36 bg-gradient-to-br from-red-500/20 via-blue-500/10 to-blue-600/20 flex items-center justify-center border-b border-border">
                <span className="text-6xl">🕷️</span>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg mb-2">Marvel&apos;s Spider-Man 2</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  L&apos;admiration vient ici de la prouesse technique. Traverser New York à toute vitesse sans aucun temps de chargement, passer d&apos;un personnage à l&apos;autre instantanément grâce au SSD de la console, le tout avec du Ray Tracing, c&apos;est une démonstration de force.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface overflow-hidden hover:border-primary/30 transition-all">
              <div className="h-36 bg-gradient-to-br from-purple-500/20 via-pink-500/10 to-orange-500/20 flex items-center justify-center border-b border-border">
                <span className="text-6xl">🔧</span>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg mb-2">Ratchet &amp; Clank: Rift Apart</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Un véritable film d&apos;animation Pixar jouable. Le jeu utilise la puissance de la console pour faire voyager le joueur à travers des failles temporelles vers d&apos;autres mondes en moins d&apos;une seconde, sans transition.
                </p>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
