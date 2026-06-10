import { TrendingUp, Shield, Zap } from "lucide-react";

const STATS = [
  { value: "$76B+", label: "Volume 24h", icon: TrendingUp },
  { value: "185K+", label: "Utilisateurs", icon: Shield },
  { value: "< 0.10%", label: "Frais les plus bas", icon: Zap },
];

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 px-4 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
      <div className="max-w-7xl mx-auto text-center relative">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary-light text-sm mb-6">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          Plateforme crypto de confiance
        </div>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-4">
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">KongoPay</span>
          <br />
          Achetez & Vendez des Cryptos
        </h1>
        <p className="text-text-secondary text-lg md:text-xl max-w-2xl mx-auto mb-8">
          La plateforme crypto simple et sécurisée pour l&apos;Afrique francophone. Achetez, vendez et gagnez
          avec des frais parmi les plus bas du marché.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <a href="/inscription" className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl font-semibold text-lg transition-all hover:scale-105">
            Créer un compte gratuit
          </a>
          <a href="/" className="border border-border hover:bg-surface text-text px-8 py-3 rounded-xl font-semibold text-lg transition-all">
            Voir les marchés
          </a>
        </div>
        <div className="grid grid-cols-3 gap-4 md:gap-8 max-w-lg mx-auto">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <stat.icon className="w-5 h-5 mx-auto mb-2 text-primary" />
              <div className="text-xl md:text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-text-muted">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
