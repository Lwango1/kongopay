import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import MarketOverview from "@/components/MarketOverview";
import PredictionGame from "@/components/PredictionGame";
import Converter from "@/components/Converter";
import PriceAlert from "@/components/PriceAlert";
import AdBanner from "@/components/AdBanner";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <AdBanner slot="1234567890" className="py-8 max-w-4xl mx-auto" />
        <MarketOverview />
        <AdBanner slot="1234567891" format="horizontal" className="py-8 mx-auto flex justify-center" />
        <PredictionGame />
        <Converter />
        <PriceAlert />
      </main>
      <Footer />
    </>
  );
}
