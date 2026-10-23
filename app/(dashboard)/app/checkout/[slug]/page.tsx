import { getAuthUser, getRequestSupabase } from "@/lib/dashboard/session";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckoutContent } from "@/components/checkout/CheckoutContent";
import { SEPAY_CONFIG, getSePayQRUrl } from "@/lib/sepay";

const VALID_SLUGS = ["bodix-21", "bodix-6w", "bodix-12w"] as const;

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!VALID_SLUGS.includes(slug as (typeof VALID_SLUGS)[number])) {
    redirect("/app/programs");
  }

  const supabase = await getRequestSupabase();
  // getUser dùng chung với layout trong cùng request (React cache).
  const user = await getAuthUser();

  if (!user) redirect("/login");

  // Profile, program, đợt gần nhất (lọc qua join theo slug) và đơn đang chờ
  // độc lập nhau → một đợt song song (trước đây 4 lượt nối tiếp).
  const todayStr = new Date().toISOString().split("T")[0];
  const service = createServiceClient();
  const [
    { data: profile },
    { data: program },
    { data: cohortRow },
    { data: pendingOrder },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, trial_ends_at")
      .eq("id", user.id)
      .single(),
    supabase
      .from("programs")
      .select("id, slug, name, description, price_vnd, duration_days")
      .eq("slug", slug)
      .eq("is_active", true)
      .single(),
    supabase
      .from("cohorts")
      .select("id, name, start_date, max_members, current_members, program_id, programs!inner(slug)")
      .eq("programs.slug", slug)
      .in("status", ["upcoming", "active"])
      .gte("start_date", todayStr)
      .order("start_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    // Resume: nếu user đã có pending order cho program này, mở thẳng QR view.
    service
      .from("orders")
      .select("id, amount, payment_code, payment_status")
      .eq("user_id", user.id)
      .eq("program", slug)
      .eq("payment_status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Determine trial state for cohort-info copy: "trial_active" (in trial period),
  // "trial_completed" (had trial, expired), or "no_trial" (never trialled).
  let trialState: "trial_active" | "trial_completed" | "no_trial" = "no_trial";
  if (profile?.trial_ends_at) {
    trialState =
      new Date(profile.trial_ends_at) > new Date()
        ? "trial_active"
        : "trial_completed";
  }

  if (!program) redirect("/app/programs");

  const cohort =
    cohortRow && cohortRow.program_id === program.id
      ? {
          id: cohortRow.id,
          name: cohortRow.name,
          start_date: cohortRow.start_date,
          max_members: cohortRow.max_members,
          current_members: cohortRow.current_members,
        }
      : null;

  const initialPayment =
    pendingOrder && pendingOrder.payment_code
      ? {
          orderId: String(pendingOrder.id),
          paymentCode: pendingOrder.payment_code as string,
          amount: pendingOrder.amount as number,
          qrUrl: getSePayQRUrl(
            pendingOrder.amount as number,
            pendingOrder.payment_code as string,
            "compact",
          ),
        }
      : null;

  const fullName = profile?.full_name?.trim() || user.user_metadata?.full_name || "";
  const email = user.email || "";
  const phone = profile?.phone || "";

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/app"
        className="mb-6 inline-block text-sm font-medium text-primary hover:underline"
      >
        ← Quay lại
      </Link>

      <CheckoutContent
        slug={slug}
        program={program}
        cohort={cohort}
        fullName={fullName}
        email={email}
        phone={phone}
        initialPayment={initialPayment}
        trialState={trialState}
        bankConfig={{
          bankCode: SEPAY_CONFIG.bankCode,
          bankAccount: SEPAY_CONFIG.bankAccount,
          bankAccountName: SEPAY_CONFIG.bankAccountName,
        }}
      />
    </div>
  );
}
