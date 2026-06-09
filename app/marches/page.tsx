import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MarketOverview from "@/components/MarketOverview";
import DerivChart from "@/components/DerivChart";
import AdBanner from "@/components/AdBanner";

export default function MarchesPage() {
  return (
    <>
      <Header />
      <main className="pt-24">
        <MarketOverview />
        <AdBanner slot="1234567892" format="horizontal" className="py-8 mx-auto flex justify-center" />
        <DerivChart />
      </main>
      <Footer />
    </>
  );
}
