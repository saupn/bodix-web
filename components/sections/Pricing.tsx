import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Check } from "lucide-react";

const PRICING_CARDS = [
  {
    id: "bodix-21",
    name: "BodiX 21",
    duration: "21 ngày",
    price: "499.000đ",
    perDay: "~24.000đ/ngày — rẻ hơn ly trà sữa",
    badge: "⭐ Phổ biến nhất",
    badgeStyle: "bg-primary text-white",
    features: [
      "Mỗi ngày ~7-21 phút tùy cường độ",
      "Chọn Hard (3 lượt) / Light (2 lượt) / Easy (1 lượt)",
      "21 ngày hoàn thành liên tục & Streak",
      "Nhóm tập luyện cùng đợt",
      "Hỗ trợ và nhắc tập qua Zalo",
    ],
    highlighted: true,
  },
  {
    id: "bodix-6w",
    name: "BodiX 6W",
    duration: "6 tuần",
    price: "1.199.000đ",
    perDay: "~29.000đ/ngày",
    badge: null,
    badgeStyle: "",
    features: [
      "Mỗi buổi ~14-42 phút tùy cường độ",
      "Chọn Hard (3 lượt) / Light (2 lượt) / Easy (1 lượt)",
      "42 ngày hoàn thành & Review chuyên sâu",
      "Kết quả rõ rệt từ tuần thứ 3",
      "Hỗ trợ và nhắc tập qua Zalo",
    ],
    highlighted: false,
  },
  {
    id: "bodix-12w",
    name: "BodiX 12W",
    duration: "12 tuần",
    price: "1.999.000đ",
    perDay: "~24.000đ/ngày — tiết kiệm nhất",
    badge: "🔥 Lột xác toàn diện",
    badgeStyle: "bg-orange-100 text-orange-800",
    features: [
      "Mỗi buổi ~14-42 phút tùy cường độ",
      "Chọn Hard (3 lượt) / Light (2 lượt) / Easy (1 lượt)",
      "84 ngày hoàn thành & reflection giữa chương trình",
      "Hướng dẫn dinh dưỡng đi kèm",
      "Hỗ trợ và nhắc tập qua Zalo",
    ],
    highlighted: false,
  },
] as const;

export function Pricing() {
  return (
    <section id="pricing" className="py-12 md:py-20 lg:py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-6">
        <SectionHeading
          title="Chọn hành trình của bạn"
          subtitle="Thanh toán 1 lần. Không subscription. Không phí ẩn."
        />
        <div className="mt-8 sm:mt-12 grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-3">
          {PRICING_CARDS.map((card) => (
            <div
              key={card.id}
              className={`relative flex flex-col rounded-2xl border-2 bg-white p-6 sm:p-8 shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${
                card.highlighted
                  ? "border-primary shadow-lg ring-2 ring-primary/20"
                  : "border-neutral-200"
              }`}
            >
              {card.badge && (
                <span
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium ${card.badgeStyle}`}
                >
                  {card.badge}
                </span>
              )}
              <div className="text-center">
                <h3 className="font-heading text-xl sm:text-2xl font-bold text-primary">
                  {card.name}
                </h3>
                <p className="mt-1 text-sm text-neutral-500">{card.duration}</p>
                <p className="mt-4 text-2xl sm:text-3xl font-bold text-neutral-900">
                  {card.price}
                </p>
                <p className="mt-1 text-sm text-neutral-500">{card.perDay}</p>
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {card.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-neutral-600"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link
                  href="/signup"
                  className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-medium text-secondary-light transition-colors hover:bg-primary-dark"
                >
                  Bắt đầu miễn phí 3 ngày
                </Link>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-neutral-500 max-w-2xl mx-auto">
          Thanh toán 1 lần. Không subscription. Không phí ẩn.
        </p>
      </div>
    </section>
  );
}
