import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Bodix12wHero } from "@/components/landing/Bodix12wHero";
import { Bodix12wWarning } from "@/components/landing/Bodix12wWarning";
import { Bodix12wDesign } from "@/components/landing/Bodix12wDesign";
import { Bodix12wResults } from "@/components/landing/Bodix12wResults";
import { Bodix12wRequirements } from "@/components/landing/Bodix12wRequirements";
import { Bodix12wEquipment } from "@/components/landing/Bodix12wEquipment";
import { Bodix12wFAQ } from "@/components/landing/Bodix12wFAQ";
import { Bodix12wFinalCTA } from "@/components/landing/Bodix12wFinalCTA";
import { Bodix12wProgramNav } from "@/components/landing/Bodix12wProgramNav";

export const metadata = {
  title: "BodiX 12W – 12 tuần để thay đổi rõ rệt | BodiX",
  description:
    "Chương trình cao cấp nhất. Chỉ dành cho người sẵn sàng cam kết 84 ngày. Không đường tắt. Kết quả thật.",
};

export default function Bodix12wPage() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-900">
      <Header />
      <main className="flex-1">
        <Bodix12wHero />
        <Bodix12wWarning />
        <Bodix12wDesign />
        <Bodix12wResults />
        <Bodix12wRequirements />
        <Bodix12wEquipment />
        <Bodix12wFAQ />
        <Bodix12wFinalCTA />
        <Bodix12wProgramNav />
      </main>
      <Footer />
    </div>
  );
}
