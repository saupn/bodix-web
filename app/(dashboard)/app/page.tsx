import Link from "next/link";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DashboardHomeContent } from "@/components/dashboard/DashboardHomeContent";

function formatCountdown(trialEndsAt: string): string {
  const end = new Date(trialEndsAt);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return "0 ngày 0 giờ";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return `${days} ngày ${hours} giờ`;
}

const PROGRAM_CARDS = [
  {
    slug: "bodix-21",
    name: "BodiX 21",
    duration: "21 ngày",
    price: "499.000đ",
    perDay: "~24.000đ/ngày — rẻ hơn ly trà sữa",
    badge: "⭐ Phổ biến nhất",
    note: null,
    features: [
      "5 phiên tập + phục hồi + Review Chủ nhật mỗi tuần",
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
    badge: null as string | null,
    note: "Phù hợp nếu bạn đã có nền tảng tập luyện",
    features: [
      "2 phiên tập xen kẽ mỗi buổi (~50 phút)",
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
    perDay: "~24.000đ/ngày — tiết kiệm nhất",
    badge: "🔥 Lột xác toàn diện",
    note: "Cường độ cao, phù hợp người đã tập ít nhất 6 tuần",
    features: [
      "Phiên thường + phiên nâng cao (~60 phút)",
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
    message: "🎉 Chúc mừng hoàn thành BodiX 21! Tiếp tục với BodiX 6W — giảm 15%!",
    targetSlug: "bodix-6w",
  },
  "bodix-6w": {
    message: "🎉 Chúc mừng hoàn thành BodiX 6W! Tiếp tục với BodiX 12W — giảm 15%!",
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
            <p className="mt-1 text-sm text-neutral-500">{card.duration}</p>
            <p className="mt-4 text-2xl font-bold text-neutral-900">
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

export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, trial_ends_at")
    .eq("id", user.id)
    .single();

  const displayName = profile?.full_name?.trim() || user.email || "bạn";
  const trialEndsAt = profile?.trial_ends_at;
  const now = new Date();
  const isInTrial = trialEndsAt && new Date(trialEndsAt) > now;
  const trialEnded = trialEndsAt && new Date(trialEndsAt) <= now;

  const { data: activeEnrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  const hasActiveEnrollment = !!activeEnrollment;

  if (hasActiveEnrollment) {
    return <DashboardHomeContent displayName={displayName} />;
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

  const upgradeBanner =
    UPGRADE_BANNERS[completedSlugs.includes("bodix-6w") ? "bodix-6w" : ""]
    ?? UPGRADE_BANNERS[completedSlugs.includes("bodix-21") ? "bodix-21" : ""]
    ?? null;

  if (isInTrial) {
    return (
      <div className="space-y-8">
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 sm:p-6">
          <h2 className="font-heading text-lg font-semibold text-primary">
            Bạn đang trong 3 ngày trải nghiệm miễn phí
          </h2>
          <p className="mt-2 text-neutral-600">
            Khám phá các chương trình BodiX và chọn hành trình phù hợp với bạn.
          </p>
          <p className="mt-4 text-sm font-medium text-primary">
            Còn {formatCountdown(trialEndsAt!)} trải nghiệm
          </p>
        </div>

        {upgradeBanner && (
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
        )}

        <div>
          <h2 className="font-heading text-xl font-bold text-primary mb-6">
            Chọn hành trình của bạn
          </h2>
          <ProgramCardGrid
            cta="Thử nghiệm miễn phí 3 ngày"
            ctaHref={(slug) => `/app/checkout/${slug}`}
          />
          <p className="mt-6 text-center text-sm text-neutral-500">
            Thanh toán 1 lần. Không subscription. Không phí ẩn.
          </p>
        </div>
      </div>
    );
  }

  if (trialEnded) {
    return (
      <div className="space-y-8">
        <div className="rounded-xl border-2 border-accent/30 bg-accent/5 p-4 sm:p-6">
          <h2 className="font-heading text-lg font-semibold text-primary">
            Thời gian trải nghiệm đã hết
          </h2>
          <p className="mt-2 text-neutral-600">
            Chọn chương trình để bắt đầu hành trình thay đổi!
          </p>
        </div>

        {upgradeBanner && (
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
        )}

        <div>
          <h2 className="font-heading text-xl font-bold text-primary mb-6">
            Chọn hành trình của bạn
          </h2>
          <ProgramCardGrid
            cta="Thử nghiệm miễn phí 3 ngày"
            ctaHref={(slug) => `/app/checkout/${slug}`}
          />
          <p className="mt-6 text-center text-sm text-neutral-500">
            Thanh toán 1 lần. Không subscription. Không phí ẩn.
          </p>
        </div>
      </div>
    );
  }

  // No trial — welcome state
  return (
    <div className="space-y-8">
      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 sm:p-6">
        <h2 className="font-heading text-lg font-semibold text-primary">
          Chào mừng {displayName}!
        </h2>
        <p className="mt-2 text-neutral-600">
          Khám phá các chương trình BodiX và chọn hành trình phù hợp với bạn.
        </p>
      </div>

      <div>
        <h2 className="font-heading text-xl font-bold text-primary mb-6">
          Chọn hành trình của bạn
        </h2>
        <ProgramCardGrid
          cta="Thử nghiệm miễn phí 3 ngày"
          ctaHref={(slug) => `/app/checkout/${slug}`}
        />
        <p className="mt-6 text-center text-sm text-neutral-500">
          Thanh toán 1 lần. Không subscription. Không phí ẩn.
        </p>
      </div>
    </div>
  );
}
