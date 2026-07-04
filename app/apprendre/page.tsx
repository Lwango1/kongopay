import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdBanner from "@/components/AdBanner";
import NewsTrader from "@/components/NewsTrader";

const GUIDES = [
  {
    title: "Qu'est-ce que la Crypto ?",
    desc: "Comprenez les bases de la blockchain, du Bitcoin et des altcoins.",
    content: "La crypto-monnaie est une monnaie numérique décentralisée utilisant la technologie blockchain. Contrairement aux monnaies traditionnelles émises par les banques centrales, les cryptos fonctionnent sur un réseau peer-to-peer sans intermédiaire. Bitcoin, créé en 2009 par Satoshi Nakamoto, a été la première crypto-monnaie. Aujourd'hui, il existe plus de 10 000 crypto-monnaies avec une capitalisation totale dépassant les 1 000 milliards de dollars. La blockchain est un registre distribué et immuable qui enregistre toutes les transactions de manière transparente et sécurisée."
  },
  {
    title: "Sécurité & Stockage",
    desc: "Protégez vos actifs avec les wallets, le stockage à froid et le 2FA.",
    content: "La sécurité de vos crypto-actifs est primordiale. Un wallet (portefeuille) peut être chaud (connecté à Internet, pratique mais plus risqué) ou froid (hors ligne, plus sécurisé). Les hardware wallets comme Ledger ou Trezor offrent le meilleur niveau de sécurité pour le stockage à long terme. Activez toujours l'authentification à deux facteurs (2FA) sur vos comptes d'échange. Ne partagez jamais vos clés privées et méfiez-vous des tentatives de phishing. Les plateformes sérieuses utilisent le stockage à froid pour la majorité des fonds."
  },
  {
    title: "Analyser le Marché",
    desc: "Apprenez à lire les graphiques, les bougies et les indicateurs techniques.",
    content: "L'analyse technique est essentielle pour trader les crypto-monnaies. Les graphiques en chandeliers (candlesticks) affichent le prix d'ouverture, de clôture, le plus haut et le plus bas sur une période donnée. Les indicateurs clés incluent le RSI (Relative Strength Index) qui mesure la force d'une tendance, les moyennes mobiles (MA) qui lissent les variations de prix, et le volume qui confirme la force des mouvements. Les niveaux de support et résistance sont des zones où le prix a historiquement rebondi ou cassé. Le Ichimoku Kinko Hyo est un indicateur complet très utilisé pour le trading de cryptos."
  },
  {
    title: "Staking & Earn",
    desc: "Faites fructifier vos cryptos avec le staking, l'épargne et la DeFi.",
    content: "Le staking consiste à verrouiller vos crypto-monnaies pour participer à la validation des transactions sur une blockchain Proof-of-Stake (PoS). En échange, vous recevez des récompenses sous forme d'intérêts. Ethereum est passé au PoS avec la Merge en 2022, offrant des rendements attractifs aux validateurs. Des plateformes comme Lido ou Rocket Pool permettent de staker avec des montants plus faibles. Les protocoles DeFi (Aave, Compound, Uniswap) offrent des opportunités de lending, borrowing et yield farming. Attention toutefois aux risques de smart contracts et d'impermanent loss."
  },
  {
    title: "La Blockchain",
    desc: "Comment fonctionne la technologie décentralisée et ses applications.",
    content: "La blockchain est une technologie de stockage et de transmission d'informations transparente, sécurisée et décentralisée. Elle fonctionne comme un grand livre numérique distribué où chaque bloc de données est lié au précédent par une fonction de hachage cryptographique. Les applications dépassent largement les crypto-monnaies : traçabilité des produits, smart contracts, NFTs, identité numérique, vote électronique, finance décentralisée (DeFi). Ethereum a révolutionné le secteur en introduisant les smart contracts, des programmes autonomes exécutés sur la blockchain. Les frais de transaction (gas fees) varient selon la congestion du réseau."
  },
  {
    title: "Glossaire Crypto",
    desc: "Tous les termes essentiels expliqués simplement.",
    content: "ATH (All-Time High) : prix le plus haut jamais atteint par un actif. Whale : investisseur détenant une grande quantité de cryptos. FOMO (Fear Of Missing Out) : peur de rater une opportunité d'achat. FUD (Fear, Uncertainty, Doubt) : peur et incertitude semées sur le marché. HODL : terme issu d'une faute d'orthographe signifiant 'hold', conserver ses cryptos à long terme. Pump & Dump : manipulation de marché où le prix est artificiellement gonflé puis vendu. Bag holder : investisseur resté avec des actifs après une chute de prix. DYOR (Do Your Own Research) : faites vos propres recherches avant d'investir."
  },
];

const ARTICLES = [
  {
    title: "Comment acheter votre première crypto sur KongoPay ?",
    category: "Guide",
    excerpt: "Découvrez le processus pas à pas pour acheter votre premier Bitcoin ou Ethereum via KongoPay. Notre plateforme simplifie l'achat de crypto-monnaies pour les utilisateurs africains."
  },
  {
    title: "Les frais de trading les plus bas d'Afrique",
    category: "Actualité",
    excerpt: "Avec des frais de maker à partir de 0.05%, KongoPay propose les tarifs les plus compétitifs du marché africain. Comparez les frais des principales plateformes."
  },
  {
    title: "Guide complet du trading P2P sur KongoPay",
    category: "Guide",
    excerpt: "Le trading peer-to-peer vous permet d'acheter et vendre des cryptos directement avec d'autres utilisateurs. Découvrez comment sécuriser vos transactions P2P."
  },
  {
    title: "Comprendre la volatilité des cryptos",
    category: "Analyse",
    excerpt: "Pourquoi les prix des crypto-monnaies fluctuent-ils autant ? Analyse des facteurs qui influencent la volatilité : actualités réglementaires, adoption institutionnelle, cycles de marché."
  },
  {
    title: "5 stratégies de gestion des risques pour traders",
    category: "Conseils",
    excerpt: "Protégez votre capital avec ces stratégies essentielles : diversification, stop-loss, position sizing, ratio risque/récompense et tenue de journal de trading."
  },
  {
    title: "L'avenir de la finance décentralisée en Afrique",
    category: "Analyse",
    excerpt: "La DeFi représente une opportunité unique pour l'Afrique francophone : accès aux services financiers, réduction des frais d'envoi de fonds, épargne en devises stables."
  },
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
            Que vous soyez débutant ou trader expérimenté, nos guides vous accompagnent.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {GUIDES.map((g) => (
              <div key={g.title} className="rounded-xl border border-border bg-surface p-6 hover:border-primary/30 transition-colors cursor-pointer">
                <h3 className="font-semibold mb-2">{g.title}</h3>
                <p className="text-sm text-text-secondary mb-3">{g.desc}</p>
                <p className="text-xs text-text-muted leading-relaxed">{g.content.length > 150 ? g.content.slice(0, 150) + "..." : g.content}</p>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-center mb-2">Articles & Actualités</h2>
          <p className="text-text-secondary text-center mb-8 max-w-2xl mx-auto">
            Restez informé des dernières tendances et analyses du marché des crypto-monnaies.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {ARTICLES.map((a) => (
              <div key={a.title} className="rounded-xl border border-border bg-surface overflow-hidden hover:border-primary/30 transition-all group">
                <div className="h-2 bg-gradient-to-r from-primary to-secondary" />
                <div className="p-5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">{a.category}</span>
                  <h3 className="font-bold text-lg mt-1 mb-2 group-hover:text-primary transition-colors">{a.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{a.excerpt}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-4 mb-8">
          <AdBanner slot="learn-banner" format="horizontal" />
        </div>
        <NewsTrader />
      </main>
      <Footer />
    </>
  );
}
