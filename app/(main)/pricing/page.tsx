import Link from "next/link";
import { Lock } from "lucide-react";
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
    requires: null as string | null,
    requiresName: null as string | null,
  },
  {
    key: "bodix6w" as const,
    badge: null,
    highlighted: false,
    requires: "bodix21",
    requiresName: "BodiX 21",
  },
  {
    key: "bodix12w" as const,
    badge: "Cao cấp",
    highlighted: false,
    requires: "bodix6w",
    requiresName: "BodiX 6W",
  },
];

export default function PricingPage() {
  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-[#2D4A3E] sm:text-3xl">
        Chọn chương trình của bạn
      </h1>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {CARD_CONFIG.map(({ key, badge, highlighted, requires, requiresName }) => {
          const program = PROGRAMS[key];
          const locked = requires !== null;
          return (
            <div
              key={key}
              className={`relative rounded-2xl border-2 p-6 ${
                locked
                  ? "cursor-not-allowed border-neutral-200 bg-white opacity-60"
                  : highlighted
                    ? "border-[#2D4A3E] bg-white shadow-lg"
                    : "border-neutral-200 bg-white"
              }`}
            >
              {badge && !locked && (
                <span className="mb-4 inline-block rounded-full bg-[#2D4A3E] px-3 py-1 text-xs font-medium text-white">
                  {badge}
                </span>
              )}
              {locked && (
                <span className="mb-4 inline-flex items-center gap-1 rounded-full bg-neutral-700 px-3 py-1 text-xs font-medium text-white">
                  <Lock className="h-3 w-3" /> Khoá
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
              {locked ? (
                <>
                  <button
                    type="button"
                    disabled
                    className="mt-6 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-neutral-200 py-3 text-center font-semibold text-neutral-500"
                  >
                    <Lock className="h-4 w-4" />
                    Nâng cấp sau khi hoàn thành {requiresName}
                  </button>
                  <p className="mt-2 text-center text-xs text-neutral-500">
                    Hoàn thành {requiresName} để mở khoá
                  </p>
                </>
              ) : (
                <Link
                  href={`/checkout?program=${key}`}
                  className="mt-6 block w-full rounded-xl bg-[#2D4A3E] py-3 text-center font-semibold text-white transition-colors hover:bg-[#243d32]"
                >
                  Đăng ký ngay
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
