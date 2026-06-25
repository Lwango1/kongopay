import Header from "@/components/Header";
import DerivChart from "@/components/DerivChart";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main className="pt-24">
        <DerivChart />
      </main>
      <Footer />
    </>
  );
}
