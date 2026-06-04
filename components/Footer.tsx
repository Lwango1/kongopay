const FOOTER_SECTIONS = [
  { title: "À propos", links: ["À propos de nous", "Carrières", "Presse", "Blog", "Communauté", "KongoPay Labs"] },
  { title: "Produits", links: ["Exchange", "Acheter des Cryptos", "P2P Trading", "Convertir", "KongoPay Pay", "KongoPay Earn"] },
  { title: "Services", links: ["Télécharger", "Application Bureau", "API Trading", "Frais", "Statut du Système", "Parrainage"] },
  { title: "Support", links: ["Centre d'aide", "Chat en Direct", "Feedback", "Tutoriels", "Centre de Sécurité"] },
];

export default function Footer() {
  return (
    <footer className="border-t border-border pt-16 pb-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">K</div>
              <span className="font-bold text-lg">KongoPay</span>
            </div>
            <p className="text-sm text-text-secondary">La plateforme crypto de confiance pour tous.</p>
            <div className="flex gap-3 mt-4">
              {["X", "In", "Tg", "Fb", "Yt"].map((s) => (
                <a key={s} href="#" className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-xs text-text-muted hover:bg-surface-light transition-colors">{s}</a>
              ))}
            </div>
          </div>
          {FOOTER_SECTIONS.map((s) => (
            <div key={s.title}>
              <h4 className="font-semibold text-sm mb-4">{s.title}</h4>
              <ul className="space-y-2.5">
                {s.links.map((l) => (
                  <li key={l}><a href="#" className="text-sm text-text-muted hover:text-text-secondary transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
          <p>&copy; 2026 KongoPay. Tous droits réservés.</p>
          <div className="flex gap-4">
            <a href="#">Conditions</a>
            <a href="#">Confidentialité</a>
            <a href="#">Avis de Risque</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
