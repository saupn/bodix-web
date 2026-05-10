import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Check, Lock } from "lucide-react";
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
      "21 ngày hoàn thành liên tục & Chuỗi ngày",
      "Nhóm tập luyện cùng đợt",
      "Hỗ trợ và nhắc tập qua Zalo",
    ],
    highlighted: true,
    requires: null as string | null,
    requiresName: null as string | null,
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
      "42 ngày hoàn thành & Tổng kết chuyên sâu",
      "Kết quả rõ rệt từ tuần thứ 3",
      "Hỗ trợ và nhắc tập qua Zalo",
    ],
    highlighted: false,
    requires: "bodix-21",
    requiresName: "BodiX 21",
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
    requires: "bodix-6w",
    requiresName: "BodiX 6W",
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

type EnrollmentStatus =
  | "trial"
  | "trial_completed"
  | "pending_payment"
  | "paid_waiting_cohort"
  | "active"
  | "completed"
  | "paused"
  | "dropped";

const TRIAL_DONE_STATUSES = new Set<EnrollmentStatus>([
  "trial_completed",
  "pending_payment",
  "paid_waiting_cohort",
  "active",
  "completed",
  "dropped",
]);

export default async function ProgramsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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

  const { data: programs } = await supabase
    .from("programs")
    .select("id, slug")
    .order("sort_order", { ascending: true });

  const programIdBySlug: Record<string, string> = {};
  for (const p of programs ?? []) {
    programIdBySlug[p.slug] = p.id;
  }

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("status, programs(slug)")
    .eq("user_id", user.id);

  // Slug → set of statuses user has for that program
  const statusesBySlug = new Map<string, Set<EnrollmentStatus>>();
  for (const e of enrollments ?? []) {
    const prog = e.programs as unknown as { slug: string } | null;
    const slug = prog?.slug;
    if (!slug) continue;
    if (!statusesBySlug.has(slug)) statusesBySlug.set(slug, new Set());
    statusesBySlug.get(slug)!.add(e.status as EnrollmentStatus);
  }

  const hasCompleted = (slug: string) =>
    statusesBySlug.get(slug)?.has("completed") ?? false;
  const hasPaidWaiting = (slug: string) =>
    statusesBySlug.get(slug)?.has("paid_waiting_cohort") ?? false;
  const hasPendingPayment = (slug: string) => {
    const s = statusesBySlug.get(slug);
    return (s?.has("pending_payment") || s?.has("trial_completed")) ?? false;
  };
  const isTrialing = (slug: string) =>
    statusesBySlug.get(slug)?.has("trial") ?? false;
  const trialDone = (slug: string) => {
    const s = statusesBySlug.get(slug);
    if (!s) return false;
    for (const status of s) if (TRIAL_DONE_STATUSES.has(status)) return true;
    return false;
  };

  // Pending order — ưu tiên hiển thị nút "Tiếp tục thanh toán".
  const service = createServiceClient();
  const { data: pendingOrder } = await service
    .from("orders")
    .select("program")
    .eq("user_id", user.id)
    .eq("payment_status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const pendingOrderSlug = pendingOrder?.program ?? null;

  const upgradeBanner =
    UPGRADE_BANNERS[hasCompleted("bodix-6w") ? "bodix-6w" : ""]
    ?? UPGRADE_BANNERS[hasCompleted("bodix-21") ? "bodix-21" : ""]
    ?? null;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
        Chọn hành trình của bạn
      </h1>
      <p className="mt-2 text-neutral-600">
        Thanh toán 1 lần. Không subscription. Không phí ẩn.
      </p>

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

          // Tiered unlock: card khoá khi requires chưa completed
          const locked =
            card.requires !== null && !hasCompleted(card.requires);

          const cardCompleted = hasCompleted(card.slug);
          const cardPaidWaiting = hasPaidWaiting(card.slug);
          const cardPendingPay = hasPendingPayment(card.slug);
          const cardTrialing = isTrialing(card.slug);
          const cardTrialDone = trialDone(card.slug);
          const cardHasPendingOrder = pendingOrderSlug === card.slug;

          return (
            <div
              key={card.slug}
              className={`relative flex flex-col rounded-2xl border-2 bg-white p-6 sm:p-8 shadow-md transition-all duration-200 ${
                locked
                  ? "cursor-not-allowed border-neutral-200 opacity-60"
                  : "hover:-translate-y-1 hover:shadow-lg"
              } ${
                !locked && card.highlighted
                  ? "border-primary shadow-lg ring-2 ring-primary/20"
                  : "border-neutral-200"
              }`}
            >
              {card.badge && !locked && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">
                  {card.badge}
                </span>
              )}
              {locked && (
                <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-neutral-700 px-3 py-1 text-xs font-medium text-white">
                  <Lock className="h-3 w-3" /> Khoá
                </span>
              )}

              <div className="text-center">
                <h3 className="font-heading text-xl sm:text-2xl font-bold text-primary">
                  {card.name}
                </h3>
                <p className="mt-1 text-sm text-neutral-600">{card.duration}</p>
                <p className="mt-4 text-2xl sm:text-3xl font-bold text-neutral-900">
                  {card.price}
                </p>
                <p className="mt-1 text-sm text-neutral-600">{card.perDay}</p>
              </div>

              {card.note && (
                <p className="mt-3 text-center text-xs italic text-neutral-600">
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
                {/* ── Locked tier ──────────────────────────────────────── */}
                {locked && (
                  <>
                    <button
                      type="button"
                      disabled
                      className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-neutral-200 px-5 py-3 text-sm font-medium text-neutral-500"
                    >
                      <Lock className="h-4 w-4" />
                      Nâng cấp sau khi hoàn thành {card.requiresName}
                    </button>
                    <p className="mt-2 text-center text-xs text-neutral-500">
                      Hoàn thành {card.requiresName} để mở khoá
                    </p>
                  </>
                )}

                {/* Ưu tiên 1: có pendingOrder cho card này → Tiếp tục thanh toán */}
                {!locked && cardHasPendingOrder && (
                  <Link
                    href={`/app/checkout/${card.slug}`}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-medium text-secondary-light transition-colors hover:bg-primary-dark"
                  >
                    Tiếp tục thanh toán
                  </Link>
                )}

                {/* Ưu tiên 2: đã hoàn thành */}
                {!locked && !cardHasPendingOrder && cardCompleted && (
                  <button
                    type="button"
                    disabled
                    className="inline-flex w-full cursor-default items-center justify-center rounded-lg bg-neutral-100 px-5 py-3 text-sm font-medium text-neutral-600"
                  >
                    ✅ Đã hoàn thành
                  </button>
                )}

                {/* Ưu tiên 3: paid_waiting_cohort */}
                {!locked && !cardHasPendingOrder && !cardCompleted && cardPaidWaiting && (
                  <button
                    type="button"
                    disabled
                    className="inline-flex w-full cursor-default items-center justify-center rounded-lg bg-green-100 px-5 py-3 text-sm font-medium text-green-700"
                  >
                    ✅ Đã thanh toán – Chờ đợt tập mở
                  </button>
                )}

                {/* Ưu tiên 4: pending_payment / trial_completed → Thanh toán ngay */}
                {!locked && !cardHasPendingOrder && !cardCompleted && !cardPaidWaiting && cardPendingPay && (
                  <Link
                    href={`/app/checkout/${card.slug}`}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-medium text-secondary-light transition-colors hover:bg-primary-dark"
                  >
                    Thanh toán ngay – {card.price}
                  </Link>
                )}

                {/* Ưu tiên 5: trial đang chạy → Đang trải nghiệm */}
                {!locked &&
                  !cardHasPendingOrder &&
                  !cardCompleted &&
                  !cardPaidWaiting &&
                  !cardPendingPay &&
                  cardTrialing && (
                    <button
                      type="button"
                      disabled
                      className="inline-flex w-full cursor-default items-center justify-center rounded-lg bg-neutral-100 px-5 py-3 text-sm font-medium text-neutral-600"
                    >
                      Đang trải nghiệm
                    </button>
                  )}

                {/* Ưu tiên 6: chưa có gì + đã trial xong cho card khác → cho thanh toán */}
                {!locked &&
                  !cardHasPendingOrder &&
                  !cardCompleted &&
                  !cardPaidWaiting &&
                  !cardPendingPay &&
                  !cardTrialing &&
                  card.slug !== "bodix-21" && (
                    <Link
                      href={`/app/checkout/${card.slug}`}
                      className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-medium text-secondary-light transition-colors hover:bg-primary-dark"
                    >
                      Đăng ký {card.name} – {card.price}
                    </Link>
                  )}

                {/* Ưu tiên 7: BodiX 21 chưa có enrollment → tập thử / đăng ký theo trial done */}
                {!locked &&
                  !cardHasPendingOrder &&
                  !cardCompleted &&
                  !cardPaidWaiting &&
                  !cardPendingPay &&
                  !cardTrialing &&
                  card.slug === "bodix-21" && (
                    cardTrialDone ? (
                      <Link
                        href={`/app/checkout/${card.slug}`}
                        className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-medium text-secondary-light transition-colors hover:bg-primary-dark"
                      >
                        Đăng ký chính thức – {card.price}
                      </Link>
                    ) : programId ? (
                      <TrialStartButton
                        programId={programId}
                        programName={card.name}
                        className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-medium text-secondary-light transition-colors hover:bg-primary-dark disabled:opacity-60"
                      >
                        Tập thử 3 ngày miễn phí
                      </TrialStartButton>
                    ) : (
                      <Link
                        href="/signup"
                        className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-medium text-secondary-light transition-colors hover:bg-primary-dark"
                      >
                        Tập thử 3 ngày miễn phí
                      </Link>
                    )
                  )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-sm text-neutral-600">
        Thanh toán 1 lần. Không subscription. Không phí ẩn.
      </p>
      <p className="mt-4 text-center">
        <Link
          href="/pricing"
          className="text-sm font-medium text-primary hover:underline"
        >
          Hoặc mua ngay (Chuyển khoản) →
        </Link>
      </p>
    </div>
  );
}
