import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Bodix21Hero } from "@/components/landing/Bodix21Hero";
import { Bodix21Problems } from "@/components/landing/Bodix21Problems";
import { Bodix21Solution } from "@/components/landing/Bodix21Solution";
import { Bodix21Video } from "@/components/landing/Bodix21Video";
import { Bodix21Benefits } from "@/components/landing/Bodix21Benefits";
import { Bodix21Results } from "@/components/landing/Bodix21Results";
import { Bodix21Audience } from "@/components/landing/Bodix21Audience";
import { Bodix21FAQ } from "@/components/landing/Bodix21FAQ";
import { Bodix21FinalCTA } from "@/components/landing/Bodix21FinalCTA";
import { Bodix21ProgramNav } from "@/components/landing/Bodix21ProgramNav";

export const metadata = {
  title: "BodiX 21 – 21 ngày để cơ thể bắt đầu thay đổi | BodiX",
  description:
    "Chương trình 21 ngày không cần phòng gym, không cần động lực bùng nổ. Chỉ cần bạn hoàn thành mỗi ngày.",
};

export default function Bodix21Page() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <Header />
      <main className="flex-1">
        <Bodix21Hero />
        <Bodix21Problems />
        <Bodix21Solution />
        <Bodix21Video />
        <Bodix21Benefits />
        <Bodix21Results />
        <Bodix21Audience />
        <Bodix21FAQ />
        <Bodix21FinalCTA />
        <Bodix21ProgramNav />
      </main>
      <Footer />
    </div>
  );
}
