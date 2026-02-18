"use client";

import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedSection } from "./AnimatedSection";

const comparison = [
  {
    aspect: "Mục tiêu",
    bodix21: "Xây nền tảng kỷ luật",
    bodix6w: "Xây hình thể rõ rệt",
  },
  {
    aspect: "Focus",
    bodix21: "Tạo thói quen xuất hiện mỗi ngày",
    bodix6w: "Tăng mật độ và cường độ",
  },
  {
    aspect: "Thành công là",
    bodix21: "Hoàn thành",
    bodix6w: "Hoàn thành + tiến bộ rõ rệt",
  },
  {
    aspect: "Phù hợp",
    bodix21: "Người mới",
    bodix6w: "Người đã có nền tảng",
  },
  {
    aspect: "Thời lượng",
    bodix21: "20-30 phút/ngày",
    bodix6w: "30-40 phút/ngày",
  },
];

export function Bodix6wCompare() {
  return (
    <section id="compare" className="bg-white py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4">
        <AnimatedSection>
          <SectionHeading title="Từ nền tảng đến form rõ rệt" />
        </AnimatedSection>
        <AnimatedSection>
          <div className="mt-12 overflow-x-auto">
            <div className="min-w-[500px] max-w-3xl mx-auto overflow-hidden rounded-xl border border-neutral-200 shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50">
                    <th className="px-4 py-4 text-left font-heading text-sm font-semibold text-primary">
                      Tiêu chí
                    </th>
                    <th className="px-4 py-4 text-left font-heading text-sm font-semibold text-neutral-600">
                      BodiX 21
                    </th>
                    <th className="px-4 py-4 text-left font-heading text-sm font-semibold text-primary">
                      BodiX 6W
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr
                      key={row.aspect}
                      className="border-b border-neutral-100 last:border-0"
                    >
                      <td className="px-4 py-4 text-sm font-medium text-neutral-700">
                        {row.aspect}
                      </td>
                      <td className="px-4 py-4 text-sm text-neutral-600">
                        {row.bodix21}
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-primary">
                        {row.bodix6w}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </AnimatedSection>
        <AnimatedSection>
          <div className="mt-8 rounded-xl border-2 border-accent/30 bg-accent/5 p-6">
            <p className="text-center text-neutral-700 md:text-lg">
              BodiX 6W không dành cho người vẫn còn bỏ giữa chừng. Nếu bạn chưa
              từng hoàn thành một chương trình tập luyện nào, hãy bắt đầu với
              BodiX 21 trước.
            </p>
            <div className="mt-4 text-center">
              <Link
                href="/bodix-21"
                className="font-semibold text-primary hover:underline"
              >
                Tôi cần bắt đầu với BodiX 21 →
              </Link>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
