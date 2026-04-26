import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { TrialStartButton } from "@/components/dashboard/TrialStartButton";

const PROGRAM_CARDS = [
  {
    slug: "bodix-21",
    name: "BodiX 21",
    duration: "21 ngày",
    price: "499.000đ",
    perDay: "~24.000đ/ngày – rẻ hơn ly trà sữa",
    badge: "⭐ Phổ biến nhất",
    note: null,
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
    slug: "bodix-6w",
    name: "BodiX 6W",
    duration: "6 tuần",
    price: "1.199.000đ",
    perDay: "~29.000đ/ngày",
    badge: null,
    note: "Phù hợp nếu bạn đã có nền tảng tập luyện",
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
    slug: "bodix-12w",
    name: "BodiX 12W",
    duration: "12 tuần",
    price: "1.999.000đ",
    perDay: "~24.000đ/ngày – tiết kiệm nhất",
    badge: "🔥 Lột xác toàn diện",
    note: "Cường độ cao, phù hợp người đã tập ít nhất 6 tuần",
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

const UPGRADE_BANNERS: Record<string, { message: string; targetSlug: string }> = {
  "bodix-21": {
    message: "🎉 Chúc mừng hoàn thành BodiX 21! Tiếp tục với BodiX 6W – giảm 15%!",
    targetSlug: "bodix-6w",
  },
  "bodix-6w": {
    message: "🎉 Chúc mừng hoàn thành BodiX 6W! Tiếp tục với BodiX 12W – giảm 15%!",
    targetSlug: "bodix-12w",
  },
};

export default async function ProgramsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check if user already has an active enrollment
  const { data: activeEnrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (activeEnrollment) {
    redirect("/app");
  }

  // Fetch programs from DB to get IDs for trial start
  const { data: programs } = await supabase
    .from("programs")
    .select("id, slug")
    .order("sort_order", { ascending: true });

  const programIdBySlug: Record<string, string> = {};
  for (const p of programs ?? []) {
    programIdBySlug[p.slug] = p.id;
  }

  // Check completed enrollments for upgrade banners
  const { data: completedEnrollments } = await supabase
    .from("enrollments")
    .select("program_id, programs(slug)")
    .eq("user_id", user.id)
    .eq("status", "completed");

  const completedSlugs = (completedEnrollments ?? [])
    .map((e) => {
      const prog = e.programs as unknown as { slug: string } | null;
      return prog?.slug;
    })
    .filter(Boolean) as string[];

  // Find the highest-level completed program for upgrade banner
  const upgradeBanner =
    UPGRADE_BANNERS[completedSlugs.includes("bodix-6w") ? "bodix-6w" : ""]
    ?? UPGRADE_BANNERS[completedSlugs.includes("bodix-21") ? "bodix-21" : ""]
    ?? null;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
        Chọn hành trình của bạn
      </h1>
      <p className="mt-2 text-neutral-600">
        Thanh toán 1 lần. Không subscription. Không phí ẩn.
      </p>

      {/* Upgrade banner */}
      {upgradeBanner && (
        <div className="mt-6 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 sm:p-5">
          <p className="font-medium text-primary text-sm sm:text-base">
            {upgradeBanner.message}
          </p>
          <Link
            href={`/app/checkout/${upgradeBanner.targetSlug}`}
            className="mt-3 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-secondary-light transition-colors hover:bg-primary-dark"
          >
            Đăng ký ngay với ưu đãi
          </Link>
        </div>
      )}

      <div className="mt-8 grid gap-6 grid-cols-1 md:grid-cols-3">
        {PROGRAM_CARDS.map((card) => {
          const programId = programIdBySlug[card.slug];

          return (
            <div
              key={card.slug}
              className={`relative flex flex-col rounded-2xl border-2 bg-white p-6 sm:p-8 shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${
                card.highlighted
                  ? "border-primary shadow-lg ring-2 ring-primary/20"
                  : "border-neutral-200"
              }`}
            >
              {card.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">
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

              {card.note && (
                <p className="mt-3 text-center text-xs italic text-neutral-500">
                  {card.note}
                </p>
              )}

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
                {programId ? (
                  <TrialStartButton
                    programId={programId}
                    programName={card.name}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-medium text-secondary-light transition-colors hover:bg-primary-dark disabled:opacity-60"
                  >
                    Thử nghiệm miễn phí 3 ngày
                  </TrialStartButton>
                ) : (
                  <Link
                    href="/signup"
                    className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-medium text-secondary-light transition-colors hover:bg-primary-dark"
                  >
                    Thử nghiệm miễn phí 3 ngày
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-sm text-neutral-500">
        Thanh toán 1 lần. Không subscription. Không phí ẩn.
      </p>
      <p className="mt-4 text-center">
        <Link
          href="/pricing"
          className="text-sm font-medium text-primary hover:underline"
        >
          Hoặc mua ngay (MoMo / Chuyển khoản) →
        </Link>
      </p>
    </div>
  );
}
