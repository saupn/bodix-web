import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ReferralLandingClient } from "@/components/landing/ReferralLandingClient";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const PROGRAM_SLUGS = [
  { slug: "bodix-21", name: "BodiX 21", duration: "21 ngày" },
  { slug: "bodix-6w", name: "BodiX 6W", duration: "6 tuần" },
  { slug: "bodix-12w", name: "BodiX 12W", duration: "12 tuần" },
] as const;

export default async function ReferralLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const codeUpper = code?.trim().toUpperCase();
  if (!codeUpper) notFound();

  const supabase = await createClient();

  // Ưu tiên referral_codes, fallback profiles.referral_code (mã cá nhân hóa)
  let referralCode: {
    id: string;
    user_id: string;
    code_type: string;
    referee_reward_type: string;
    referee_reward_value: number;
    is_active: boolean;
    expires_at: string | null;
    max_uses: number | null;
    total_conversions: number;
  } | null = null;

  const { data: refCode, error: refError } = await supabase
    .from("referral_codes")
    .select("id, user_id, code_type, referee_reward_type, referee_reward_value, is_active, expires_at, max_uses, total_conversions")
    .eq("code", codeUpper)
    .maybeSingle();

  if (!refError && refCode) {
    referralCode = refCode;
  } else {
    const { data: profileWithCode } = await supabase
      .from("profiles")
      .select("id")
      .eq("referral_code", codeUpper)
      .maybeSingle();
    if (profileWithCode) {
      referralCode = {
        id: "",
        user_id: profileWithCode.id,
        code_type: "referral",
        referee_reward_type: "discount_percent",
        referee_reward_value: 10,
        is_active: true,
        expires_at: null,
        max_uses: null,
        total_conversions: 0,
      };
    }
  }

  if (!referralCode) notFound();
  if (!referralCode.is_active) notFound();
  if (referralCode.expires_at && new Date(referralCode.expires_at) < new Date()) notFound();
  if (referralCode.max_uses != null && referralCode.total_conversions >= referralCode.max_uses) notFound();

  const { data: referrerProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", referralCode.user_id)
    .single();

  const fullName = referrerProfile?.full_name?.trim() ?? "";
  const referrerName = fullName.split(/\s+/)[0] || "Một người bạn";

  const discountPercent =
    referralCode.referee_reward_type === "discount_percent"
      ? referralCode.referee_reward_value
      : 10;

  const { data: programs } = await supabase
    .from("programs")
    .select("id, slug, name, price_vnd, duration_days")
    .in("slug", PROGRAM_SLUGS.map((p) => p.slug))
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
