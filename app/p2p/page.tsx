import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function P2PPage() {
  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen">
        <section className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold mb-4">Trading P2P</h1>
          <p className="text-text-secondary mb-8">Achetez et vendez des cryptos directement entre utilisateurs.</p>
          <div className="rounded-xl border border-border bg-surface p-12">
            <p className="text-text-muted">Annonces P2P disponibles bientôt...</p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
