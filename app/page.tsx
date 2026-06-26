import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import DerivChart from "@/components/DerivChart";
import MarketScanner from "@/components/MarketScanner";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen md:ml-64 transition-all duration-300">
      <Header />
      <main>
        <Hero />
        <Features />
        <MarketScanner />
        <DerivChart />
      </main>
      <Footer />
    </div>
  );
}
