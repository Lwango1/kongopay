import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import MarketOverview from "@/components/MarketOverview";
import TradingMockup from "@/components/TradingMockup";
import Converter from "@/components/Converter";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <MarketOverview />
        <TradingMockup />
        <Converter />
      </main>
      <Footer />
    </>
  );
}
