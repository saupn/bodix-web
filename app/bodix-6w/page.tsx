import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Bodix6wHero } from "@/components/landing/Bodix6wHero";
import { Bodix6wCompare } from "@/components/landing/Bodix6wCompare";
import { Bodix6wFocus } from "@/components/landing/Bodix6wFocus";
import { Bodix6wProgression } from "@/components/landing/Bodix6wProgression";
import { Bodix6wAudience } from "@/components/landing/Bodix6wAudience";
import { Bodix6wResults } from "@/components/landing/Bodix6wResults";
import { Bodix6wFAQ } from "@/components/landing/Bodix6wFAQ";
import { Bodix6wFinalCTA } from "@/components/landing/Bodix6wFinalCTA";
import { Bodix6wProgramNav } from "@/components/landing/Bodix6wProgramNav";

export const metadata = {
  title: "BodiX 6W – 6 tuần để bắt đầu thấy form rõ rệt | BodiX",
  description:
    "Chương trình 6 tuần cho người đã có nền tảng. Tăng mật độ và cường độ để thấy đường nét rõ rệt.",
};

export default function Bodix6wPage() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <Header />
      <main className="flex-1">
        <Bodix6wHero />
        <Bodix6wCompare />
        <Bodix6wFocus />
        <Bodix6wProgression />
        <Bodix6wAudience />
        <Bodix6wResults />
        <Bodix6wFAQ />
        <Bodix6wFinalCTA />
        <Bodix6wProgramNav />
      </main>
      <Footer />
    </div>
  );
}
