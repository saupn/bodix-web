"use client";

import {
  Play,
  Target,
  Home,
  MessageCircle,
  Calendar,
  LifeBuoy,
} from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedSection } from "./AnimatedSection";

const benefits = [
  {
    icon: Play,
    title: "21 buổi tập video",
    description:
      "Mỗi buổi 20-30 phút, hướng dẫn chi tiết từng động tác",
  },
  {
    icon: Target,
    title: "Thiết kế full body",
    description:
      "Tập trung vào eo, mông, đùi, bắp tay – những vùng phụ nữ muốn cải thiện",
  },
  {
    icon: Home,
    title: "Không cần thiết bị",
    description:
      "Tập hoàn toàn tại nhà, chỉ cần một khoảng trống nhỏ",
  },
  {
    icon: MessageCircle,
    title: "Nhắc nhở qua Zalo",
    description:
      "Không cần tự nhớ, hệ thống sẽ nhắc bạn đúng giờ mỗi ngày",
  },
  {
    icon: Calendar,
    title: "Cấu trúc 6+1",
    description:
      "6 ngày tập + 1 ngày review mỗi tuần để nhìn lại tiến trình",
  },
  {
    icon: LifeBuoy,
    title: "Cơ chế rescue",
    description:
      "Hỗ trợ đặc biệt trong những ngày 3-5, khi dễ bỏ cuộc nhất",
  },
];

export function Bodix21Benefits() {
  return (
    <section id="benefits" className="bg-secondary py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4">
        <AnimatedSection>
          <SectionHeading title="Những gì có trong BodiX 21" />
        </AnimatedSection>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map(({ icon: Icon, title, description }) => (
            <AnimatedSection key={title}>
              <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-heading text-lg font-semibold text-primary">
                  {title}
                </h3>
                <p className="mt-2 text-neutral-600">{description}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
