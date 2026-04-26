import Link from "next/link";
import { PROGRAMS, formatPrice } from "@/lib/config/pricing";

const FEATURES = [
  "Tin nhắn nhắc tập qua Zalo mỗi ngày",
  "3 cường độ: Hard / Light / Easy – cả 3 đều tính hoàn thành",
  "Rescue protocol khi bạn muốn bỏ cuộc",
];

const CARD_CONFIG = [
  {
    key: "bodix21" as const,
    badge: "Phổ biến nhất",
    highlighted: true,
  },
  {
    key: "bodix6w" as const,
    badge: null,
    highlighted: false,
  },
  {
    key: "bodix12w" as const,
    badge: "Cao cấp",
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-[#2D4A3E] sm:text-3xl">
        Chọn chương trình của bạn
      </h1>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {CARD_CONFIG.map(({ key, badge, highlighted }) => {
          const program = PROGRAMS[key];
          return (
            <div
              key={key}
              className={`rounded-2xl border-2 p-6 ${
                highlighted
                  ? "border-[#2D4A3E] bg-white shadow-lg"
                  : "border-neutral-200 bg-white"
              }`}
            >
              {badge && (
                <span className="mb-4 inline-block rounded-full bg-[#2D4A3E] px-3 py-1 text-xs font-medium text-white">
                  {badge}
                </span>
              )}
              <h3 className="font-heading text-xl font-bold text-[#2D4A3E]">
                {program.name}
              </h3>
              <p className="mt-1 text-sm text-neutral-500">{program.duration}</p>
              <p className="mt-4 text-3xl font-bold text-[#2D4A3E]">
                {formatPrice(program.price)}
              </p>
              <ul className="mt-6 space-y-2">
                {FEATURES.map((f) => (
                  <li key={f} className="text-sm text-neutral-600">
                    • {f}
                  </li>
                ))}
              </ul>
              <Link
                href={`/checkout?program=${key}`}
                className="mt-6 block w-full rounded-xl bg-[#2D4A3E] py-3 text-center font-semibold text-white transition-colors hover:bg-[#243d32]"
              >
                Đăng ký ngay
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
