import Link from "next/link";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasMinDaysBeforeCohortForTrial } from "@/lib/trial/utils";
import { getTrialDisplayStatus } from "@/lib/trial/status";
import { formatDateVn } from "@/lib/date/vietnam";
import { DashboardHomeContent } from "@/components/dashboard/DashboardHomeContent";
import { TrialSignupCard } from "@/components/dashboard/TrialSignupCard";
import { BuddyChooser } from "@/components/dashboard/BuddyChooser";
import { GiftBookCard } from "@/components/dashboard/GiftBookCard";

const PROGRAM_NAME: Record<string, string> = {
  "bodix-21": "BodiX 21",
  "bodix-6w": "BodiX 6W",
  "bodix-12w": "BodiX 12W",
};

function PendingPaymentBanner({
  program,
  amount,
  paymentCode,
}: {
  program: string;
  amount: number;
  paymentCode: string;
}) {
  const programName = PROGRAM_NAME[program] ?? program;
  return (
    <Link
      href={`/app/checkout/${program}`}
      className="block rounded-xl border-2 border-orange-300 bg-orange-50 p-4 transition-colors hover:border-orange-400 hover:bg-orange-100"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💳</span>
          <div>
            <p className="font-medium text-orange-900">
              Còn 1 bước nữa: thanh toán giữ chỗ đợt tập tiếp theo
            </p>
            <p className="mt-0.5 text-sm text-orange-800">
              {programName} · Mã: <span className="font-mono font-semibold">{paymentCode}</span> ·{" "}
              {new Intl.NumberFormat("vi-VN").format(amount)}đ
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white">
          Thanh toán ngay
        </span>
      </div>
    </Link>
  );
}

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
  },
  {
    slug: "bodix-6w",
    name: "BodiX 6W",
    duration: "6 tuần",
    price: "1.199.000đ",
    perDay: "~29.000đ/ngày",
    badge: null as string | null,
    note: "Phù hợp nếu bạn đã có nền tảng tập luyện",
    features: [
      "Mỗi buổi ~14-42 phút tùy cường độ",
      "Chọn Hard (3 lượt) / Light (2 lượt) / Easy (1 lượt)",
      "42 ngày hoàn thành & Tổng kết chuyên sâu",
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
];

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

function ProgramCardGrid({ cta, ctaHref }: { cta: string; ctaHref: (slug: string) => string }) {
  return (
    <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
      {PROGRAM_CARDS.map((card) => (
        <div
          key={card.slug}
          className={`relative flex flex-col rounded-2xl border-2 bg-white p-6 shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${
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
            <h3 className="font-heading text-xl font-bold text-primary">
              {card.name}
            </h3>
            <p className="mt-1 text-sm text-neutral-600">{card.duration}</p>
            <p className="mt-4 text-2xl font-bold text-neutral-900">
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
            <Link
              href={ctaHref(card.slug)}
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-medium text-secondary-light transition-colors hover:bg-primary-dark"
            >
              {cta}
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

function UpgradeBanner({ upgradeBanner }: { upgradeBanner: { message: string; targetSlug: string } }) {
  return (
    <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 sm:p-5">
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
  );
}

export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, trial_ends_at, phone_verified")
    .eq("id", user.id)
    .single();

  const displayName = profile?.full_name?.trim() || user.email || "bạn";

  // Fetch all enrollments to determine state
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, status, program_id, cohort_id, started_at, current_day, programs(slug, name)")
    .eq("user_id", user.id)
    .order("enrolled_at", { ascending: false });

  const allEnrollments = enrollments ?? [];
  const activeEnrollment = allEnrollments.find((e) => e.status === "active");
  const trialEnrollment = allEnrollments.find((e) => e.status === "trial");
  const trialCompletedEnrollment = allEnrollments.find((e) => e.status === "trial_completed");
  const pendingPaymentEnrollment = allEnrollments.find((e) => e.status === "pending_payment");
  const paidWaitingEnrollment = allEnrollments.find((e) => e.status === "paid_waiting_cohort");
  const completedEnrollments = allEnrollments.filter((e) => e.status === "completed");
  const hasEverTrialed = allEnrollments.some((e) =>
    ["trial", "trial_completed", "pending_payment", "paid_waiting_cohort", "active", "completed"].includes(e.status)
  );

  // Pending order — hiện banner ở mọi state để user resume thanh toán.
  const service = createServiceClient();
  const { data: pendingOrder } = await service
    .from("orders")
    .select("id, program, amount, payment_code, payment_status")
    .eq("user_id", user.id)
    .eq("payment_status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const pendingBanner =
    pendingOrder && pendingOrder.payment_code ? (
      <PendingPaymentBanner
        program={pendingOrder.program as string}
        amount={pendingOrder.amount as number}
        paymentCode={pendingOrder.payment_code as string}
      />
    ) : null;

  // --- State 1: Active enrollment → show dashboard ---
  if (activeEnrollment) {
    return (
      <>
        {pendingBanner && <div className="mb-6">{pendingBanner}</div>}
        <DashboardHomeContent displayName={displayName} phoneVerified={profile?.phone_verified ?? false} />
      </>
    );
  }

  // --- State 2: Paid, waiting for cohort to start ---
  if (paidWaitingEnrollment) {
    // Fetch cohort name + start_date — nếu chưa gán cohort, query upcoming gần nhất
    let cohortName: string | null = null;
    let cohortStartDate: string | null = null;

    if (paidWaitingEnrollment.cohort_id) {
      const { data: cohort } = await supabase
        .from("cohorts")
        .select("name, start_date")
        .eq("id", paidWaitingEnrollment.cohort_id)
        .single();
      cohortName = cohort?.name ?? null;
      cohortStartDate = cohort?.start_date ?? null;
    } else if (paidWaitingEnrollment.program_id) {
      const todayStr = new Date().toISOString().split("T")[0];
      const { data: nextCohort } = await supabase
        .from("cohorts")
        .select("name, start_date")
        .eq("program_id", paidWaitingEnrollment.program_id)
        .eq("status", "upcoming")
        .gte("start_date", todayStr)
        .order("start_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      cohortName = nextCohort?.name ?? null;
      cohortStartDate = nextCohort?.start_date ?? null;
    }

    // Đã có buddy chưa? Chỉ check khi đã được gán cohort_id.
    let buddyName: string | null = null;
    if (paidWaitingEnrollment.cohort_id) {
      const { data: existingPair } = await service
        .from("buddy_pairs")
        .select("user_a, user_b")
        .eq("cohort_id", paidWaitingEnrollment.cohort_id)
        .eq("status", "active")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .limit(1)
        .maybeSingle();
      if (existingPair) {
        const buddyUserId =
          existingPair.user_a === user.id ? existingPair.user_b : existingPair.user_a;
        const { data: buddyProfile } = await service
          .from("profiles")
          .select("full_name")
          .eq("id", buddyUserId)
          .single();
        buddyName = buddyProfile?.full_name ?? "Buddy";
      }
    }
    const hasBuddy = !!buddyName;

    return (
      <div className="space-y-8">
        {pendingBanner}
        <div className="rounded-xl border-2 border-success/30 bg-success/5 p-6 sm:p-8 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="font-heading text-xl font-bold text-primary sm:text-2xl">
            Thanh toán xác nhận!
          </h2>
          {cohortName && cohortStartDate ? (
            <>
              <p className="mt-3 text-neutral-700">
                Đợt tập sắp tới:{" "}
                <span className="font-semibold text-primary">{cohortName}</span>{" "}
                – bắt đầu ngày{" "}
                <span className="font-semibold text-primary">
                  {formatDateVn(cohortStartDate)}
                </span>
                .
              </p>
              <p className="mt-2 text-neutral-600">
                Bạn sẽ nhận thông báo qua Zalo trước khi đợt mở.
              </p>
            </>
          ) : (
            <p className="mt-3 text-neutral-700">
              Bạn sẽ nhận thông báo khi đợt tập tiếp theo mở (thường trong 1-2
              tuần).
            </p>
          )}
        </div>

        <GiftBookCard />

        {/* Buddy state */}
        {paidWaitingEnrollment.cohort_id && !hasBuddy && <BuddyChooser />}
        {paidWaitingEnrollment.cohort_id && hasBuddy && buddyName && (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h3 className="font-heading text-base font-semibold text-primary">
              👯 Buddy đồng hành
            </h3>
            <p className="mt-2 text-neutral-700">
              Bạn đã ghép cặp với{" "}
              <span className="font-semibold text-primary">{buddyName}</span>.
              Khi đợt tập bắt đầu, hai bạn có thể chat 1-1 trong app để động
              viên nhau.
            </p>
          </div>
        )}
      </div>
    );
  }

  // --- State 3: Selected by admin, pending payment ---
  if (pendingPaymentEnrollment) {
    const prog = pendingPaymentEnrollment.programs as unknown as { slug: string; name: string } | null;
    const slug = prog?.slug ?? "bodix-21";

    return (
      <div className="space-y-8">
        {pendingBanner}
        <GiftBookCard />
        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-6 sm:p-8 text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="font-heading text-xl font-bold text-primary sm:text-2xl">
            Bạn đã được chọn!
          </h2>
          <p className="mt-3 text-neutral-600">
            Thanh toán để giữ chỗ trong đợt tập sắp tới.
          </p>
          <Link
            href={`/app/checkout/${slug}`}
            className="mt-6 inline-flex items-center rounded-lg bg-primary px-6 py-3 text-base font-semibold text-secondary-light transition-colors hover:bg-primary-dark"
          >
            Thanh toán ngay
          </Link>
        </div>
      </div>
    );
  }

  // --- State 4: Trial completed, waiting to be selected ---
  if (trialCompletedEnrollment) {
    return (
      <div className="space-y-8">
        {pendingBanner}
        <GiftBookCard />
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6 sm:p-8 text-center">
          <div className="text-4xl mb-4">🎯</div>
          <h2 className="font-heading text-xl font-bold text-primary sm:text-2xl">
            Tập thử hoàn thành!
          </h2>
          <p className="mt-3 text-neutral-600">
            Đăng ký tập chính thức và chờ thông báo nếu bạn được chọn tham gia!
          </p>
          <Link
            href="/app/checkout/bodix-21"
            className="mt-6 inline-flex items-center rounded-lg bg-primary px-6 py-3 text-base font-semibold text-secondary-light transition-colors hover:bg-primary-dark"
          >
            Đăng ký tập chính thức
          </Link>
        </div>
      </div>
    );
  }

  // --- State 5: Trial enrollment exists ---
  if (trialEnrollment) {
    const trial = getTrialDisplayStatus({
      started_at: (trialEnrollment.started_at as string | null) ?? null,
    });

    if (trial.isEnded) {
      return (
        <div className="space-y-8">
          {pendingBanner}
          <div className="rounded-xl border-2 border-accent/30 bg-accent/5 p-4 sm:p-6">
            <h2 className="font-heading text-lg font-semibold text-primary">
              {trial.headingText}
            </h2>
            <p className="mt-2 text-neutral-700">{trial.subtextTop}</p>
          </div>
          <GiftBookCard />
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {pendingBanner}
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 sm:p-6">
          <h2 className="font-heading text-lg font-semibold text-primary">
            {trial.headingText}
          </h2>
          <p className="mt-2 text-neutral-700">{trial.subtextTop}</p>
          {trial.daysRemainingText && (
            <p className="mt-4 text-sm font-medium text-primary">
              {trial.daysRemainingText}
            </p>
          )}
        </div>

        <Link
          href="/app/trial"
          className="block rounded-xl border border-neutral-200 bg-white p-6 transition hover:border-primary hover:shadow-sm"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-heading text-base font-semibold text-neutral-900">
                Bài tập trải nghiệm thử
              </h3>
              <p className="mt-1 text-sm text-neutral-600">
                {trial.hasStarted
                  ? `Ngày ${trial.currentDay}/${trial.totalDays} – xem bài tập hôm nay`
                  : "Bắt đầu từ ngày mai. Xem trước bài tập đầu tiên?"}
              </p>
            </div>
            <span className="shrink-0 text-lg text-primary">→</span>
          </div>
        </Link>

        <Link
          href="/app/checkout/bodix-21"
          className="block rounded-xl border-2 border-primary bg-primary/5 p-6 transition hover:bg-primary/10"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-heading text-base font-semibold text-primary">
                Đăng ký chính thức – BodiX 21
              </h3>
              <p className="mt-1 text-sm text-neutral-700">
                Sẵn sàng bắt đầu hành trình 21 ngày ngay – 499.000đ
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-secondary-light">
              Thanh toán
            </span>
          </div>
        </Link>

        <GiftBookCard />
      </div>
    );
  }

  // --- State 6: No enrollment at all ---
  const completedSlugs = completedEnrollments
    .map((e) => {
      const prog = e.programs as unknown as { slug: string } | null;
      return prog?.slug;
    })
    .filter(Boolean) as string[];
  const upgradeBanner =
    UPGRADE_BANNERS[completedSlugs.includes("bodix-6w") ? "bodix-6w" : ""]
    ?? UPGRADE_BANNERS[completedSlugs.includes("bodix-21") ? "bodix-21" : ""]
    ?? null;

  // If user has completed programs → show upgrade path
  if (completedEnrollments.length > 0) {
    return (
      <div className="space-y-8">
        {pendingBanner}
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 sm:p-6">
          <h2 className="font-heading text-lg font-semibold text-primary">
            Chào mừng {displayName}!
          </h2>
          <p className="mt-2 text-neutral-600">
            Chọn chương trình tiếp theo để tiếp tục hành trình.
          </p>
        </div>
        <GiftBookCard />
        {upgradeBanner && <UpgradeBanner upgradeBanner={upgradeBanner} />}
        <div>
          <h2 className="font-heading text-xl font-bold text-primary mb-6">
            Chọn hành trình của bạn
          </h2>
          <ProgramCardGrid
            cta="Đăng ký ngay"
            ctaHref={(slug) => `/app/checkout/${slug}`}
          />
        </div>
      </div>
    );
  }

  // Brand new user — show trial signup card
  const { data: bodix21 } = await supabase
    .from("programs")
    .select("id")
    .eq("slug", "bodix-21")
    .eq("is_active", true)
    .maybeSingle();

  const { data: nextCohort } = bodix21?.id
    ? await supabase
        .from("cohorts")
        .select("id, start_date, name")
        .eq("program_id", bodix21.id)
        .eq("status", "upcoming")
        .order("start_date", { ascending: true })
        .limit(1)
        .maybeSingle()
    : { data: null };

  // Từ ngày mai (D1 trial) đến cohort cần ≥ 3 ngày lịch — xem hasMinDaysBeforeCohortForTrial
  let canTrial = false;
  let nextCohortDate: string | null = null;

  if (nextCohort) {
    nextCohortDate = nextCohort.start_date;
    canTrial = hasMinDaysBeforeCohortForTrial(nextCohort.start_date) && !hasEverTrialed;
  } else {
    // No upcoming cohort — allow trial (admin will create cohort later)
    canTrial = !hasEverTrialed;
  }

  return (
    <div className="space-y-8">
      {pendingBanner}
      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 sm:p-6">
        <h2 className="font-heading text-lg font-semibold text-primary">
          Sẵn sàng bắt đầu, {displayName}!
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          Đăng ký tập thử 3 ngày miễn phí để bắt đầu hành trình.
        </p>
      </div>

      <GiftBookCard />

      <TrialSignupCard
        canTrial={canTrial}
        hasEverTrialed={hasEverTrialed}
        programId={bodix21?.id ?? null}
        nextCohortDate={nextCohortDate}
      />
    </div>
  );
}
