"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedSection } from "./AnimatedSection";

const recommended = [
  "Đã hoàn thành BodiX 21 hoặc 6W – Bạn đã chứng minh khả năng đi đến cuối",
  "Có nền tảng tập luyện ổn định – Ít nhất 2-3 tháng tập đều đặn gần đây",
  "Sẵn sàng cam kết 12 tuần – Không phải \"thử xem sao\", mà quyết định làm",
  "Có thời gian 40-50 phút mỗi ngày – 6 ngày/tuần, không ngoại lệ",
];

export function Bodix12wRequirements() {
  return (
    <section id="requirements" className="bg-secondary py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4">
        <AnimatedSection>
          <SectionHeading title="Ai nên tham gia BodiX 12W?" />
        </AnimatedSection>
        <div className="mt-12 space-y-6">
          {recommended.map((item) => (
            <AnimatedSection key={item.slice(0, 40)}>
              <div className="flex gap-4 rounded-xl border-2 border-success/30 bg-white p-6">
                <Check className="h-6 w-6 shrink-0 text-success" />
                <p className="font-medium text-neutral-800">✓ {item}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
        <AnimatedSection>
          <div className="mt-12 rounded-xl border-2 border-neutral-400 bg-white p-6">
            <h4 className="mb-4 flex items-center gap-2 font-heading text-lg font-bold text-neutral-700">
              <X className="h-5 w-5 text-amber-600" />
              Không nên tham gia
            </h4>
            <ul className="space-y-4">
              <li className="flex gap-3 text-neutral-600">
                <span className="text-amber-600">✗</span>
                <span>
                  Bạn chưa từng hoàn thành một chương trình nào →{" "}
                  <Link
                    href="/bodix-21"
                    className="font-semibold text-primary hover:underline"
                  >
                    Bắt đầu với BodiX 21
                  </Link>
                </span>
              </li>
              <li className="flex gap-3 text-neutral-600">
                <span className="text-amber-600">✗</span>
                <span>
                  Bạn vẫn còn bỏ buổi thường xuyên →{" "}
                  <Link
                    href="/bodix-6w"
                    className="font-semibold text-primary hover:underline"
                  >
                    Củng cố kỷ luật với BodiX 6W trước
                  </Link>
                </span>
              </li>
              <li className="flex gap-3 text-neutral-600">
                <span className="text-amber-600">✗</span>
                <span>
                  Bạn muốn kết quả nhanh mà không cam kết → 12W không dành cho
                  bạn
                </span>
              </li>
            </ul>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
