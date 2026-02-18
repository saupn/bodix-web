"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedSection } from "./AnimatedSection";

export function Bodix12wWarning() {
  return (
    <section id="warning" className="bg-white py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4">
        <AnimatedSection>
          <SectionHeading
            title='Dừng lại nếu bạn vẫn còn hỏi "Hôm nay có nên tập không?"'
          />
        </AnimatedSection>
        <AnimatedSection>
          <div className="mt-12 space-y-4 text-center text-neutral-700 md:text-lg">
            <p className="font-medium">
              BodiX 12W không phải chương trình để &quot;thử xem sao&quot;.
            </p>
            <p className="font-medium">
              Không phải chương trình để bắt đầu rồi bỏ giữa chừng.
            </p>
            <p className="font-medium">
              Không phải chương trình cho người vẫn còn cần động lực để tập.
            </p>
            <p className="font-semibold text-primary">
              Nếu bạn vẫn còn phải tự thuyết phục bản thân mỗi sáng, bạn chưa
              sẵn sàng cho 12W.
            </p>
          </div>
        </AnimatedSection>
        <AnimatedSection>
          <div className="mt-12 border-l-4 border-accent bg-neutral-100 p-6 md:p-8">
            <h3 className="font-heading text-xl font-bold text-primary">
              12W yêu cầu:
            </h3>
            <ul className="mt-4 space-y-3 text-neutral-700">
              <li className="flex gap-3">
                <span>⚡</span>
                <span>
                  <strong>Kỷ luật cao</strong> – Tập dù có muốn hay không
                </span>
              </li>
              <li className="flex gap-3">
                <span>✅</span>
                <span>
                  <strong>Hoàn thành đủ</strong> – Không bỏ buổi, không bỏ tuần
                </span>
              </li>
              <li className="flex gap-3">
                <span>🔗</span>
                <span>
                  <strong>Không bỏ chuỗi</strong> – 84 ngày liên tục, không ngoại
                  lệ
                </span>
              </li>
            </ul>
          </div>
        </AnimatedSection>
        <AnimatedSection>
          <p className="mt-8 text-center font-medium text-neutral-600">
            Nếu bạn đọc đến đây và vẫn muốn tiếp tục, có thể bạn là người phù
            hợp.
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
