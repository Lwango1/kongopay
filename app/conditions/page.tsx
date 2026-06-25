import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function ConditionsPage() {
  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen px-4">
        <article className="max-w-3xl mx-auto py-16 prose prose-invert">
          <h1>Conditions Générales d'Utilisation</h1>
          <p className="text-text-secondary">Dernière mise à jour : 25 juin 2026</p>

          <h2>1. Acceptation des conditions</h2>
          <p>En créant un compte sur KongoPay, vous acceptez les présentes conditions générales d'utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser nos services.</p>

          <h2>2. Description des services</h2>
          <p>KongoPay est une plateforme d'échange de crypto-monnaies permettant :</p>
          <ul>
            <li>L'achat et la vente de crypto-monnaies</li>
            <li>Le trading peer-to-peer (P2P)</li>
            <li>Le trading de contrats à différence sur indices synthétiques</li>
            <li>La gestion de portefeuille multi-devises</li>
            <li>La conversion entre monnaies fiduciaires et crypto-monnaies</li>
          </ul>

          <h2>3. Éligibilité</h2>
          <p>Pour utiliser KongoPay, vous devez :</p>
          <ul>
            <li>Être âgé d'au moins 18 ans</li>
            <li>Avoir la capacité juridique de contracter</li>
            <li>Ne pas être résident d'un pays sanctionné</li>
            <li>Fournir des informations exactes et à jour</li>
          </ul>

          <h2>4. Risques</h2>
          <p>Le trading de crypto-monnaies comporte des risques significatifs :</p>
          <ul>
            <li>La volatilité des prix peut entraîner des pertes totales ou partielles du capital</li>
            <li>Les performances passées ne garantissent pas les résultats futurs</li>
            <li>Les réglementations gouvernementales peuvent affecter la valeur des actifs</li>
            <li>Les risques techniques incluent les pannes de réseau et les attaques informatiques</li>
          </ul>

          <h2>5. Frais</h2>
          <p>Les frais de trading sont clairement affichés sur notre page Frais. KongoPay se réserve le droit de modifier ses frais avec un préavis de 30 jours.</p>

          <h2>6. KYC et AML</h2>
          <p>Conformément aux réglementations anti-blanchiment (AML), KongoPay exige une vérification d'identité (KYC) pour certains services. Les informations fournies sont vérifiées et stockées en toute sécurité.</p>

          <h2>7. Suspension et résiliation</h2>
          <p>KongoPay se réserve le droit de suspendre ou résilier un compte en cas de :</p>
          <ul>
            <li>Violation des présentes conditions</li>
            <li>Activité suspecte ou frauduleuse</li>
            <li>Non-respect des obligations KYC/AML</li>
            <li>Demande d'une autorité réglementaire</li>
          </ul>

          <h2>8. Propriété intellectuelle</h2>
          <p>Tous les droits de propriété intellectuelle relatifs à la plateforme KongoPay (marques, logos, code source, design) sont la propriété exclusive de KongoPay.</p>

          <h2>9. Droit applicable</h2>
          <p>Les présentes conditions sont régies par le droit de la République Démocratique du Congo. Tout litige sera soumis à la juridiction compétente de Kinshasa.</p>
        </article>
      </main>
      <Footer />
    </>
  );
}
