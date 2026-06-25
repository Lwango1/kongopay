import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function ConfidentialitePage() {
  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen px-4">
        <article className="max-w-3xl mx-auto py-16 prose prose-invert">
          <h1>Politique de Confidentialité</h1>
          <p className="text-text-secondary">Dernière mise à jour : 25 juin 2026</p>

          <h2>1. Collecte des données</h2>
          <p>KongoPay collecte les données suivantes :</p>
          <ul>
            <li>Informations d'identification : nom, email, numéro de téléphone</li>
            <li>Documents d'identité pour la vérification KYC</li>
            <li>Données de transaction : achats, ventes, dépôts, retraits</li>
            <li>Données techniques : adresse IP, type de navigateur, système d'exploitation</li>
            <li>Données de comportement : pages visitées, interactions sur la plateforme</li>
          </ul>

          <h2>2. Utilisation des données</h2>
          <p>Vos données sont utilisées pour :</p>
          <ul>
            <li>Fournir et améliorer nos services de trading</li>
            <li>Vérifier votre identité et prévenir la fraude</li>
            <li>Respecter nos obligations légales et réglementaires (KYC/AML)</li>
            <li>Vous envoyer des notifications importantes concernant votre compte</li>
            <li>Analyser et améliorer les performances de la plateforme</li>
          </ul>

          <h2>3. Partage des données</h2>
          <p>Nous ne vendons jamais vos données personnelles. Nous pouvons partager vos données avec :</p>
          <ul>
            <li>Nos prestataires de services techniques (hébergement, analyse)</li>
            <li>Les autorités réglementaires si requis par la loi</li>
            <li>Nos partenaires de vérification d'identité (KYC)</li>
          </ul>

          <h2>4. Sécurité des données</h2>
          <p>Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées pour protéger vos données, notamment le chiffrement AES-256, l'authentification à deux facteurs, et des audits de sécurité réguliers.</p>

          <h2>5. Vos droits</h2>
          <p>Conformément au RGPD, vous disposez des droits suivants :</p>
          <ul>
            <li>Droit d'accès à vos données</li>
            <li>Droit de rectification des données inexactes</li>
            <li>Droit à l'effacement (droit à l'oubli)</li>
            <li>Droit à la portabilité des données</li>
            <li>Droit d'opposition au traitement</li>
          </ul>
          <p>Pour exercer ces droits, contactez-nous à : privacy@kongopay.com</p>

          <h2>6. Cookies</h2>
          <p>Nous utilisons des cookies essentiels au fonctionnement de la plateforme, des cookies d'analyse pour comprendre l'utilisation du site, et des cookies de personnalisation pour améliorer votre expérience. Vous pouvez gérer vos préférences de cookies depuis les paramètres de votre navigateur.</p>

          <h2>7. Contact</h2>
          <p>Pour toute question concernant cette politique :<br />
          Email : privacy@kongopay.com<br />
          Adresse : Kinshasa, République Démocratique du Congo</p>
        </article>
      </main>
      <Footer />
    </>
  );
}
