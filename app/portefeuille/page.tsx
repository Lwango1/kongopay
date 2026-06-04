import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Converter from "@/components/Converter";

export default function PortefeuillePage() {
  return (
    <>
      <Header />
      <main className="pt-24 min-h-screen">
        <section className="max-w-4xl mx-auto px-4 py-16">
          <h1 className="text-4xl font-bold mb-2">Portefeuille</h1>
          <p className="text-text-secondary mb-8">Gérez vos actifs numériques en toute sécurité.</p>
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {[{ label: "Solde total", value: "$0.00" }, { label: "En trading", value: "$0.00" }, { label: "Disponible", value: "$0.00" }].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-surface p-5">
                <div className="text-sm text-text-muted mb-1">{s.label}</div>
                <div className="text-2xl font-bold">{s.value}</div>
              </div>
            ))}
          </div>
          <Converter />
        </section>
      </main>
      <Footer />
    </>
  );
}
