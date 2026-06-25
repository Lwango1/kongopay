import Header from "@/components/Header";
import Footer from "@/components/Footer";

const TEAM = [
  { name: "Jean-Pierre Lwango", role: "CEO & Fondateur", bio: "Expert en fintech et blockchain avec plus de 10 ans d'expérience dans le secteur financier africain." },
  { name: "Marie Kabeya", role: "CTO", bio: "Ingénieure en informatique spécialisée dans les systèmes de trading haute fréquence et la sécurité blockchain." },
  { name: "David Mputu", role: "Directeur des Opérations", bio: "Ancien cadre bancaire, expert en conformité réglementaire et gestion des risques financiers." },
  { name: "Sarah Tshimanga", role: "Responsable Marketing", bio: "Spécialiste du marketing digital et de la croissance des plateformes fintech en Afrique francophone." },
];

const VALUES = [
  { title: "Transparence", desc: "Nous affichons clairement nos frais, nos processus et nos décisions. Pas de surprises cachées." },
  { title: "Sécurité", desc: "La protection des fonds et des données de nos utilisateurs est notre priorité absolue." },
  { title: "Innovation", desc: "Nous utilisons les technologies les plus avancées pour offrir une expérience de trading optimale." },
  { title: "Accessibilité", desc: "Nous rendons les crypto-monnaies accessibles à tous, y compris aux non-initiés." },
  { title: "Conformité", desc: "Nous respectons les réglementations en vigueur pour opérer légalement et en toute sécurité." },
  { title: "Support", desc: "Notre équipe de support est disponible 24/7 pour répondre à vos questions." },
];

export default function AProposPage() {
  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen px-4">
        <section className="max-w-4xl mx-auto py-16">
          <h1 className="text-4xl font-bold text-center mb-4">À propos de KongoPay</h1>
          <p className="text-text-secondary text-center max-w-2xl mx-auto mb-12">
            KongoPay est née d&apos;une vision : rendre les crypto-monnaies accessibles à tous
            en Afrique francophone, avec une plateforme simple, sécurisée et transparente.
          </p>

          <div className="prose prose-invert max-w-none mb-16">
            <h2>Notre Mission</h2>
            <p>
              KongoPay a été fondée en 2024 avec une mission claire : démocratiser l&apos;accès aux
              crypto-monnaies en Afrique francophone. Nous croyons que la finance décentralisée
              peut offrir des opportunités sans précédent à des millions de personnes qui n&apos;ont
              pas accès aux services bancaires traditionnels.
            </p>
            <p>
              Notre plateforme combine une interface intuitive avec des outils de trading
              professionnels, permettant aussi bien aux débutants qu&apos;aux traders expérimentés
              de gérer leurs actifs numériques en toute confiance.
            </p>

            <h2>Notre Histoire</h2>
            <p>
              Tout a commencé à Kinshasa, où notre fondateur Jean-Pierre Lwango a constaté
              les difficultés rencontrées par les Africains pour accéder aux plateformes
              d&apos;échange de crypto-monnaies. Entre les restrictions géographiques, les frais
              élevés et le manque de support local, le fossé était immense.
            </p>
            <p>
              KongoPay est la réponse à ces défis. Notre plateforme supporte les méthodes
              de paiement locales (Airtel Money, Orange Money, M-Pesa), offre des frais
              parmi les plus bas du marché, et fournit un support en français avec une
              équipe basée en RDC.
            </p>

            <h2>Chiffres Clés</h2>
            <ul>
              <li>Plus de 185 000 utilisateurs inscrits</li>
              <li>Volume de trading mensuel dépassant 76 milliards de dollars</li>
              <li>Disponible dans 12 pays d'Afrique francophone</li>
              <li>Taux de satisfaction de 94%</li>
              <li>Plus de 350 crypto-monnaies disponibles</li>
              <li>Frais de trading à partir de 0.05%</li>
            </ul>
          </div>

          <h2 className="text-2xl font-bold text-center mb-8">Nos Valeurs</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols3 gap-6 mb-16">
            {VALUES.map((v) => (
              <div key={v.title} className="rounded-xl border border-border bg-surface p-6">
                <h3 className="font-semibold mb-2">{v.title}</h3>
                <p className="text-sm text-text-secondary">{v.desc}</p>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-center mb-8">Notre Équipe</h2>
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {TEAM.map((m) => (
              <div key={m.name} className="rounded-xl border border-border bg-surface p-6">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg mb-3">
                  {m.name.split(" ").map(n => n[0]).join("")}
                </div>
                <h3 className="font-semibold">{m.name}</h3>
                <p className="text-sm text-primary mb-2">{m.role}</p>
                <p className="text-sm text-text-secondary">{m.bio}</p>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-center mb-4">Contactez-nous</h2>
          <p className="text-text-secondary text-center max-w-xl mx-auto">
            Une question ? Notre équipe est là pour vous aider.<br />
            Email : support@kongopay.com | Téléphone : +243 996 710 821<br />
            Kinshasa, République Démocratique du Congo
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
