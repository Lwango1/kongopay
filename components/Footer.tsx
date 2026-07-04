const FOOTER_SECTIONS = [
  {
    title: "Plateforme",
    links: [
      { label: "Marchés", href: "/" },
      { label: "Trading P2P", href: "/p2p" },
      { label: "Portefeuille", href: "/portefeuille" },
      { label: "Signaux Trading", href: "/signaux" },
      { label: "Abonnement", href: "/abonnement" },
    ],
  },
  {
    title: "Apprendre",
    links: [
      { label: "Guides Crypto", href: "/apprendre" },
      { label: "Calendrier Économique", href: "/signaux" },
      { label: "Sécurité", href: "/apprendre" },
      { label: "Tutoriels", href: "/apprendre" },
    ],
  },
  {
    title: "À propos",
    links: [
      { label: "À propos de nous", href: "/a-propos" },
      { label: "Nous contacter", href: "/contact" },
      { label: "Conditions d'utilisation", href: "/conditions" },
      { label: "Confidentialité", href: "/confidentialite" },
      { label: "Avis de Risque", href: "/conditions" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-border pt-16 pb-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">K</div>
              <span className="font-bold text-lg">KongoPay</span>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              Plateforme d&apos;échange de crypto-monnaies simple, sécurisée et transparente
              pour l&apos;Afrique francophone.
            </p>
            <div className="flex gap-3">
              {[
                { label: "X", href: "https://x.com/kongopay" },
                { label: "In", href: "https://linkedin.com/company/kongopay" },
                { label: "Tg", href: "https://t.me/kongopay" },
                { label: "Fb", href: "https://facebook.com/kongopay" },
                { label: "Yt", href: "https://youtube.com/@kongopay" },
              ].map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-xs text-text-muted hover:bg-surface-light transition-colors">{s.label}</a>
              ))}
            </div>
          </div>
          {FOOTER_SECTIONS.map((s) => (
            <div key={s.title}>
              <h4 className="font-semibold text-sm mb-4">{s.title}</h4>
              <ul className="space-y-2.5">
                {s.links.map((l) => (
                  <li key={l.label}><a href={l.href} className="text-sm text-text-muted hover:text-text-secondary transition-colors">{l.label}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
          <p>&copy; 2026 KongoPay. Tous droits réservés.</p>
          <div className="flex gap-4">
            <a href="/conditions">Conditions</a>
            <a href="/confidentialite">Confidentialité</a>
            <a href="/conditions">Avis de Risque</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
