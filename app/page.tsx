import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import IntroVideo from "@/components/sections/IntroVideo";
import { Philosophy } from "@/components/sections/Philosophy";
import { Problems } from "@/components/sections/Problems";
import { Programs } from "@/components/sections/Programs";
import { Pricing } from "@/components/sections/Pricing";
import { Comparison } from "@/components/sections/Comparison";
import { FAQ } from "@/components/sections/FAQ";
import { FinalCTA } from "@/components/sections/FinalCTA";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <Header />
      <main className="flex-1">
        <Hero />
        <IntroVideo />
        <Philosophy />
        <Programs />
        <Problems />
        <Pricing />
        <Comparison />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
