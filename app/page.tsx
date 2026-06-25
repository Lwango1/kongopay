import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import DerivChart from "@/components/DerivChart";
import MarketScanner from "@/components/MarketScanner";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <MarketScanner />
        <DerivChart />
      </main>
      <Footer />
    </>
  );
}
