"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedSection } from "./AnimatedSection";

const results = [
  {
    icon: "🔄",
    title: "Cơ thể thay đổi rõ rệt",
    description:
      "Không phải cảm nhận, mà nhìn thấy. Người khác cũng nhìn thấy.",
  },
  {
    icon: "📐",
    title: "Body line hiện rõ",
    description:
      "Vai, lưng, eo, mông – đường nét bạn muốn, giờ đã có",
  },
  {
    icon: "💪",
    title: "Sức bền và form vượt trội",
    description: "Làm được những thứ bạn không nghĩ mình làm được",
  },
  {
    icon: "🧠",
    title: "Kỷ luật cá nhân nâng cấp",
    description:
      "Không chỉ về tập luyện, mà về cách bạn tiếp cận mọi thứ trong cuộc sống",
  },
];

export function Bodix12wResults() {
  return (
    <section id="results" className="bg-white py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4">
        <AnimatedSection>
          <SectionHeading title="Nếu bạn hoàn thành đủ 12 tuần" />
        </AnimatedSection>
        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          {results.map((result) => (
            <AnimatedSection key={result.title}>
              <div className="rounded-xl border-2 border-primary bg-white p-8 shadow-md">
                <span className="text-5xl">{result.icon}</span>
                <h3 className="mt-5 font-heading text-2xl font-bold text-primary">
                  {result.title}
                </h3>
                <p className="mt-3 text-lg text-neutral-600">
                  {result.description}
                </p>
              </div>
            </AnimatedSection>
          ))}
        </div>
        <AnimatedSection>
          <div className="mt-12 rounded-xl border-2 border-primary bg-primary/5 p-8 text-center">
            <p className="text-lg font-medium text-neutral-800 md:text-xl">
              Đây không phải thử nghiệm. Đây là hành trình. 84 ngày. Không đường
              tắt. Không ngoại lệ. Nhưng kết quả thì xứng đáng.
            </p>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
