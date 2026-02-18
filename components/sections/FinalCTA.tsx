import Link from "next/link";
import { CTA_PROGRAMS } from "@/lib/constants";

export function FinalCTA() {
  return (
    <section className="py-12 md:py-20 lg:py-24 bg-primary text-white">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center">
          <h2 className="font-heading text-2xl font-bold sm:text-3xl md:text-4xl">
            Chọn chương trình phù hợp với bạn
          </h2>
          <p className="mt-4 text-base sm:text-lg opacity-90">
            Bạn đã sẵn sàng bắt đầu chưa? Chọn chương trình phù hợp và đăng ký
            ngay hôm nay.
          </p>
        </div>
        <div className="mt-8 sm:mt-12 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 max-w-4xl mx-auto">
          {CTA_PROGRAMS.map((program) => (
            <Link
              key={program.href}
              href={program.href}
              className="flex flex-col items-center rounded-xl border-2 border-white/30 bg-white/10 p-4 sm:p-6 backdrop-blur transition-all hover:bg-white/20 hover:border-white/50"
            >
              <h3 className="font-heading text-xl font-semibold">
                {program.name}
              </h3>
              <p className="mt-1 text-sm opacity-90">{program.duration}</p>
              <span className="mt-4 inline-flex items-center text-sm font-medium">
                {program.cta}
              </span>
            </Link>
          ))}
        </div>
        <div className="mt-10 max-w-2xl mx-auto flex gap-3 rounded-lg bg-white/10 p-4">
          <span className="text-2xl shrink-0">💡</span>
          <p className="text-sm opacity-90">
            Chưa chắc chắn? Hãy bắt đầu với BodiX 21 – chương trình nền tảng dành
            cho tất cả mọi người.
          </p>
        </div>
      </div>
    </section>
  );
}
