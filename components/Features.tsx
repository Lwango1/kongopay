import { Shield, Zap, Wallet, BarChart3, Users, Globe } from "lucide-react";

const FEATURES = [
  { icon: Shield, title: "Sécurité Avancée", desc: "Fonds protégés avec stockage à froid, authentification 2FA et système SAFU." },
  { icon: Zap, title: "Trading Ultra-Rapide", desc: "Moteur de trading capable de traiter 1,4 million de transactions par seconde." },
  { icon: Wallet, title: "Portefeuille Multi-Actifs", desc: "Stockez plus de 350 cryptos dans un seul portefeuille sécurisé." },
  { icon: BarChart3, title: "Outils Pro", desc: "Graphiques avancés, ordre limit, stop-loss et indicateurs techniques." },
  { icon: Users, title: "Trading P2P", desc: "Achetez et vendez des cryptos directement entre utilisateurs sans intermédiaire." },
  { icon: Globe, title: "Couverture Mondiale", desc: "Disponible dans plus de 180 pays avec support multilingue 24/7." },
];

export default function Features() {
  return (
    <section className="py-20 px-4 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Pourquoi choisir <span className="text-primary">KongoPay</span> ?
        </h2>
        <p className="text-text-secondary text-center max-w-2xl mx-auto mb-12">
          La plateforme la plus complète pour acheter, vendre et gérer vos crypto-monnaies en toute sécurité.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="group p-6 rounded-xl border border-border bg-surface/50 hover:bg-surface transition-all hover:border-primary/30">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <f.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
