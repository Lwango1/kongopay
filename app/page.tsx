import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import MarketOverview from "@/components/MarketOverview";
import TradingMockup from "@/components/TradingMockup";
import PredictionGame from "@/components/PredictionGame";
import MarketScanner from "@/components/MarketScanner";
import Converter from "@/components/Converter";
import PriceAlert from "@/components/PriceAlert";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <MarketScanner />
        <MarketOverview />
        <TradingMockup />
        <PredictionGame />
        <Converter />
        <PriceAlert />
      </main>
      <Footer />
    </>
  );
}
