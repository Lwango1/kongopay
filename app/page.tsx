import Header from "@/components/Header";
import DerivChart from "@/components/DerivChart";
import MarketScanner from "@/components/MarketScanner";
import PredictionGame from "@/components/PredictionGame";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main className="pt-24">
        <MarketScanner />
        <DerivChart />
        <PredictionGame />
      </main>
      <Footer />
    </>
  );
}
