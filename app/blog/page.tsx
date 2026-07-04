import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdBanner from "@/components/AdBanner";

const POSTS = [
  {
    title: "Comment acheter votre première crypto sur KongoPay ?",
    category: "Guide",
    date: "20 juin 2026",
    author: "Jean-Pierre Lwango",
    content: `L'achat de votre première crypto-monnaie peut sembler intimidant, mais avec KongoPay, le processus est simple et sécurisé. Voici un guide pas à pas pour vous lancer.

    Étape 1 : Créez votre compte. Rendez-vous sur kongopay.com et cliquez sur "S'inscrire". Renseignez votre email, créez un mot de passe sécurisé, et vérifiez votre adresse email.

    Étape 2 : Vérifiez votre identité. Pour des raisons de sécurité et de conformité réglementaire, nous devons vérifier votre identité. Munissez-vous de votre pièce d'identité (passeport, carte d'identité nationale) et suivez les étapes de vérification KYC.

    Étape 3 : Ajoutez des fonds. Utilisez Airtel Money, Orange Money, M-Pesa ou un virement bancaire pour déposer des fonds sur votre compte KongoPay.

    Étape 4 : Achetez votre première crypto. Rendez-vous sur la page d'achat, sélectionnez la crypto de votre choix (Bitcoin, Ethereum, USDT, etc.), entrez le montant, et confirmez la transaction.

    Étape 5 : Conservez vos actifs en sécurité. Activez l'authentification à deux facteurs (2FA) et envisagez un hardware wallet pour des montants importants.`,
  },
  {
    title: "Guide complet du trading P2P sur KongoPay",
    category: "Guide",
    date: "18 juin 2026",
    author: "David Mputu",
    content: `Le trading peer-to-peer (P2P) est l'une des fonctionnalités les plus puissantes de KongoPay. Il vous permet d'acheter et de vendre des crypto-monnaies directement avec d'autres utilisateurs, sans intermédiaire.

    Avantages du trading P2P :
    - Prix négociables : vous fixez vos propres prix
    - Méthodes de paiement locales : Airtel Money, Orange Money, M-Pesa
    - Pas de frais de plateforme élevés
    - Transactions rapides et sécurisées

    Comment ça marche :
    1. Publiez une annonce d'achat ou de vente
    2. Un autre utilisateur accepte votre offre
    3. La plateforme sécurise les cryptos en escrow
    4. Effectuez le paiement via la méthode convenue
    5. Une fois le paiement confirmé, les cryptos sont libérées

    Conseils de sécurité :
    - Vérifiez toujours l'historique et la réputation de votre contrepartie
    - Utilisez le système d'escrow de KongoPay (ne jamais faire de transaction hors plateforme)
    - Conservez des preuves de paiement
    - En cas de litige, contactez notre support`,  },
  {
    title: "Analyse technique : indicateurs essentiels pour trader",
    category: "Analyse",
    date: "15 juin 2026",
    author: "Marie Kabeya",
    content: `L'analyse technique est un ensemble d'outils qui aident les traders à prédire les mouvements de prix futurs en se basant sur les données historiques du marché. Voici les indicateurs incontournables :

    Le RSI (Relative Strength Index) mesure la force d'une tendance sur une échelle de 0 à 100. Un RSI supérieur à 70 indique une surachat (le prix pourrait baisser), tandis qu'un RSI inférieur à 30 indique une survente (le prix pourrait monter).

    Les Moyennes Mobiles (MA) lissent les variations de prix sur une période donnée. La MA50 et MA200 sont particulièrement suivies. Un croisement haussier (MA50 au-dessus de MA200) signale une tendance haussière, et inversement.

    Le MACD (Moving Average Convergence Divergence) montre la relation entre deux moyennes mobiles. Un croisement au-dessus de la ligne de signal est haussier, en dessous est baissier.

    Les Bandes de Bollinger mesurent la volatilité du marché. Plus les bandes sont larges, plus la volatilité est élevée. Un prix touchant la bande supérieure ou inférieure peut signaler un retournement.`,
  },
  {
    title: "5 stratégies de gestion des risques pour traders",
    category: "Conseils",
    date: "12 juin 2026",
    author: "Sarah Tshimanga",
    content: `La gestion des risques est la compétence la plus importante pour tout trader, débutant ou expérimenté. Sans une bonne gestion des risques, même les meilleures stratégies de trading peuvent mener à la faillite.

    1. Le Stop-Loss : Définissez toujours un niveau de prix auquel votre position sera automatiquement fermée en cas de perte. Ne tradez jamais sans stop-loss.

    2. Le Position Sizing : Ne risquez jamais plus de 1-2% de votre capital total sur une seule transaction. Cette règle simple vous protège des séries de pertes.

    3. Le Ratio Risque/Récompense : Visez un ratio d'au moins 1:2, c'est-à-dire que votre gain potentiel est deux fois supérieur à votre perte potentielle.

    4. La Diversification : Ne mettez pas tous vos oeufs dans le même panier. Répartissez votre capital sur différents actifs et stratégies.

    5. Le Journal de Trading : Tenez un journal de toutes vos transactions avec les raisons d'entrée et de sortie. Analysez régulièrement vos performances pour identifier vos forces et faiblesses.`,
  },
  {
    title: "Comprendre la volatilité des crypto-monnaies",
    category: "Analyse",
    date: "10 juin 2026",
    author: "Jean-Pierre Lwango",
    content: `La volatilité est une caractéristique inhérente aux marchés des crypto-monnaies. Comprendre ses causes est essentiel pour trader sereinement.

    Facteurs de volatilité :
    - Actualités réglementaires : les annonces de régulation positive ou négative provoquent des mouvements brusques
    - Adoption institutionnelle : l'entrée de grands investisseurs (MicroStrategy, Tesla, BlackRock) influence les prix
    - Cycles de marché : le Bitcoin suit un cycle de 4 ans lié au halving, qui réduit de moitié la récompense des mineurs
    - Sentiment de marché : le FOMO et le FUD amplifient les mouvements de prix
    - Liquidité : les marchés moins liquides sont plus volatils

    Comment gérer la volatilité :
    - Utilisez le Dollar Cost Averaging (DCA) pour lisser votre prix d'entrée
    - Diversifiez votre portefeuille sur plusieurs cryptos
    - Ne tradez pas avec des fonds dont vous avez besoin à court terme
    - Gardez une vision long terme (HODL) pour traverser les cycles`,
  },
  {
    title: "L'avenir de la finance décentralisée en Afrique",
    category: "Analyse",
    date: "8 juin 2026",
    author: "David Mputu",
    content: `La finance décentralisée (DeFi) représente une opportunité transformationnelle pour l'Afrique. Avec plus de 60% de la population non bancarisée, les solutions DeFi peuvent offrir des services financiers à des millions de personnes.

    Pourquoi la DeFi est pertinente en Afrique :
    - Accès universel : n'importe qui avec un smartphone peut accéder aux protocoles DeFi
    - Frais réduits : les transactions coûtent une fraction des frais bancaires traditionnels
    - Stabilité : les stablecoins (USDT, USDC) offrent une protection contre l'inflation des monnaies locales
    - Transferts internationaux : envoyer de l'argent à travers les frontières coûte moins cher et est plus rapide

    Défis à surmonter :
    - Infrastructure internet encore limitée dans certaines régions
    - Éducation financière nécessaire pour comprendre les risques
    - Cadre réglementaire en développement
    - Volatilité des frais de gas sur Ethereum

    KongoPay s'engage à faciliter cette transition en proposant des solutions adaptées au contexte africain, avec des frais bas et un support local.`,
  },
];

export default function BlogPage() {
  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen px-4">
        <section className="max-w-5xl mx-auto py-16">
          <h1 className="text-4xl font-bold text-center mb-4">Blog & Actualités</h1>
          <p className="text-text-secondary text-center mb-12 max-w-2xl mx-auto">
            Analyses, guides et actualités du monde des crypto-monnaies. Restez informé
            avec les articles de notre équipe d&apos;experts.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {POSTS.map((post) => (
              <div key={post.title} className="rounded-xl border border-border bg-surface overflow-hidden hover:border-primary/30 transition-all group">
                <div className="h-1.5 bg-gradient-to-r from-primary to-secondary" />
                <div className="p-6">
                  <div className="flex items-center gap-2 text-xs text-text-muted mb-3">
                    <span className="text-primary font-semibold uppercase tracking-wider">{post.category}</span>
                    <span>•</span>
                    <span>{post.date}</span>
                    <span>•</span>
                    <span>{post.author}</span>
                  </div>
                  <h2 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">{post.title}</h2>
                  <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line line-clamp-4">{post.content}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <AdBanner slot="blog-banner" format="horizontal" />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
