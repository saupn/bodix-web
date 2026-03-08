import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PROGRAMS } from "@/lib/constants";
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

function ProgramCard({
  name,
  duration,
  tagline,
  slug,
  cta,
  price,
}: {
  name: string;
  duration: string;
  tagline: string;
  slug: string;
  cta: string;
  price?: string;
}) {
  return (
    <div className="rounded-xl border-2 border-neutral-200 bg-white p-6 shadow-sm transition-all duration-200 card-lift">
      <h3 className="font-heading text-xl font-semibold text-primary">{name}</h3>
      <p className="mt-1 text-sm text-accent font-medium">{duration}</p>
      <p className="mt-3 text-neutral-600 text-sm">{tagline}</p>
      {price && (
        <p className="mt-3 font-semibold text-primary">{price}</p>
      )}
      <Link
        href={slug}
        className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-secondary-light transition-colors hover:bg-primary-dark"
      >
        {cta}
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
    .select("full_name, trial_ends_at")
    .eq("id", user.id)
    .single();

  const displayName = profile?.full_name?.trim() || user.email || "bạn";
  const trialEndsAt = profile?.trial_ends_at;
  const now = new Date();
  const isInTrial =
    trialEndsAt && new Date(trialEndsAt) > now;
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

  if (isInTrial) {
    return (
      <div className="space-y-8">
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 sm:p-6">
          <h2 className="font-heading text-lg font-semibold text-primary">
            Bạn đang trong 3 ngày trải nghiệm miễn phí
          </h2>
          <p className="mt-2 text-neutral-600">
            Khám phá các chương trình BodiX và tìm hiểu cách chúng có thể giúp
            bạn.
          </p>
          <p className="mt-4 text-sm font-medium text-primary">
            Còn {formatCountdown(trialEndsAt!)} trải nghiệm
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-bold text-primary mb-4">
            Khám phá chương trình
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PROGRAMS.map((p) => (
              <ProgramCard
                key={p.id}
                name={p.name}
                duration={p.duration}
                tagline={p.tagline}
                slug={p.slug}
                cta="Tìm hiểu thêm"
              />
            ))}
          </div>
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
            Chọn chương trình để bắt đầu hành trình!
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-bold text-primary mb-4">
            Chọn chương trình phù hợp
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <ProgramCard
              name={PROGRAMS[0].name}
              duration={PROGRAMS[0].duration}
              tagline={PROGRAMS[0].tagline}
              slug={PROGRAMS[0].slug}
              cta="Đăng ký ngay"
              price="Liên hệ để biết giá"
            />
            <ProgramCard
              name={PROGRAMS[1].name}
              duration={PROGRAMS[1].duration}
              tagline={PROGRAMS[1].tagline}
              slug={PROGRAMS[1].slug}
              cta="Đăng ký ngay"
              price="Liên hệ để biết giá"
            />
            <ProgramCard
              name={PROGRAMS[2].name}
              duration={PROGRAMS[2].duration}
              tagline={PROGRAMS[2].tagline}
              slug={PROGRAMS[2].slug}
              cta="Đăng ký ngay"
              price="Liên hệ để biết giá"
            />
          </div>
        </div>
      </div>
    );
  }

  // No trial (e.g. new user, or profile not set up yet)
  return (
    <div className="space-y-8">
      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 sm:p-6">
        <h2 className="font-heading text-lg font-semibold text-primary">
          Chào mừng {displayName}!
        </h2>
        <p className="mt-2 text-neutral-600">
          Khám phá các chương trình BodiX và tìm hiểu cách chúng có thể giúp
          bạn.
        </p>
      </div>

      <div>
        <h2 className="font-heading text-xl font-bold text-primary mb-4">
          Khám phá chương trình
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PROGRAMS.map((p) => (
            <ProgramCard
              key={p.id}
              name={p.name}
              duration={p.duration}
              tagline={p.tagline}
              slug={p.slug}
              cta="Tìm hiểu thêm"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
