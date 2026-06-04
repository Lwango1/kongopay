import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MarketOverview from "@/components/MarketOverview";

export default function MarchesPage() {
  return (
    <>
      <Header />
      <main className="pt-24">
        <MarketOverview />
      </main>
      <Footer />
    </>
  );
}
