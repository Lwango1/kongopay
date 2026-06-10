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

        <section className="max-w-5xl mx-auto pb-16">
          <h2 className="text-2xl font-bold text-center mb-2">🐍 Code du Jeu (Python)</h2>
          <p className="text-text-secondary text-center mb-8 max-w-2xl mx-auto">
            Un combat RPG entre le Héros PS5 et le Titan de Feu. Copie le code et exécute-le chez toi !
          </p>
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-background/50">
              <div className="w-3 h-3 rounded-full bg-danger" />
              <div className="w-3 h-3 rounded-full bg-warning" />
              <div className="w-3 h-3 rounded-full bg-success" />
              <span className="text-xs text-text-muted font-mono ml-2">combat.py</span>
            </div>
            <pre className="p-5 text-sm font-mono leading-relaxed overflow-x-auto text-text-secondary" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
{`import random

class Personnage:
    def __init__(self, nom: str, points_vie: int, attaque: int):
        self.nom = nom
        self.points_vie = points_vie
        self.attaque_base = attaque

    def attaquer(self, cible: 'Personnage'):
        degats = random.randint(self.attaque_base - 3, self.attaque_base + 5)
        cible.points_vie -= degats
        print(f"⚔️ {self.nom} attaque {cible.nom} et inflige {degats} dégâts !")
        if cible.points_vie <= 0:
            cible.points_vie = 0
            print(f"💀 {cible.nom} est KO !")

class Boss(Personnage):
    def attaque_speciale(self, cible: Personnage):
        degats = self.attaque_base * 2
        cible.points_vie -= degats
        print(f"🔥 ATTACKE SPÉCIALE ! {self.nom} foudroie {cible.nom} avec {degats} dégâts !")

# --- TEST DU JEU ---
joueur = Personnage("Héros PS5", points_vie=100, attaque=15)
monstre = Boss("Titan de Feu", points_vie=120, attaque=12)

print(f"--- Début du combat : {joueur.nom} VS {monstre.nom} ---")
# Tour 1
joueur.attaquer(monstre)
print(f"Vie du {monstre.nom} : {monstre.points_vie} PV\\n")
# Tour du Boss
monstre.attaque_speciale(joueur)
print(f"Vie du {joueur.nom} : {joueur.points_vie} PV")`}
            </pre>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
