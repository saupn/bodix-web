import { createServiceClient } from "@/lib/supabase/service";
import { ReferralLandingClient } from "@/components/landing/ReferralLandingClient";
import { InvalidReferralPage } from "@/components/referral/InvalidReferralPage";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const PROGRAM_SLUGS = ["bodix-21", "bodix-6w", "bodix-12w"] as const;

export default async function ReferralLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const codeUpper = code?.trim().toUpperCase();

  const renderInvalid = (reason: "not_found" | "inactive" | "expired" | "exhausted") => (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <Header />
      <main className="flex-1">
        <InvalidReferralPage code={codeUpper ?? ""} reason={reason} />
      </main>
      <Footer />
    </div>
  );

  if (!codeUpper) return renderInvalid("not_found");

  const supabase = createServiceClient();

  const { data: referralCode } = await supabase
    .from("referral_codes")
    .select(
      "code, code_type, is_active, expires_at, max_uses, total_conversions, referee_reward_type, referee_reward_value, user_id",
    )
    .eq("code", codeUpper)
    .maybeSingle();

  if (!referralCode) return renderInvalid("not_found");
  if (!referralCode.is_active) return renderInvalid("inactive");
  if (referralCode.expires_at && new Date(referralCode.expires_at) < new Date()) {
    return renderInvalid("expired");
  }
  if (
    referralCode.max_uses != null &&
    (referralCode.total_conversions ?? 0) >= referralCode.max_uses
  ) {
    return renderInvalid("exhausted");
  }

  const { data: referrerProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", referralCode.user_id)
    .maybeSingle();

  const fullName = referrerProfile?.full_name?.trim() ?? "";
  const referrerName = fullName.split(/\s+/).pop() || "Một người bạn";

  const discountPercent =
    referralCode.referee_reward_type === "discount_percent"
      ? (referralCode.referee_reward_value ?? 10)
      : 10;

  const { data: programs } = await supabase
    .from("programs")
    .select("slug, name, price_vnd, duration_days")
    .in("slug", PROGRAM_SLUGS as unknown as string[])
    .eq("is_active", true);

  const programList = (programs ?? []).map((p) => ({
    slug: p.slug,
    name: p.name,
    price_vnd: p.price_vnd,
    price_after: Math.round(p.price_vnd * (1 - discountPercent / 100)),
    duration:
      p.duration_days === 21
        ? "21 ngày"
        : p.duration_days === 42
          ? "6 tuần"
          : "12 tuần",
  }));

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <Header />
      <main className="flex-1">
        <ReferralLandingClient
          code={codeUpper}
          referrerName={referrerName}
          discountPercent={discountPercent}
          programList={programList}
        />
      </main>
      <Footer />
    </div>
  );
}
