import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, trial_ends_at")
    .eq("id", user.id)
    .single();

  // Determine trial state for cohort-info copy: "trial_active" (in trial period),
  // "trial_completed" (had trial, expired), or "no_trial" (never trialled).
  let trialState: "trial_active" | "trial_completed" | "no_trial" = "no_trial";
  if (profile?.trial_ends_at) {
    trialState =
      new Date(profile.trial_ends_at) > new Date()
        ? "trial_active"
        : "trial_completed";
  }

  const { data: program } = await supabase
    .from("programs")
    .select("id, slug, name, description, price_vnd, duration_days")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!program) redirect("/app/programs");

  const todayStr = new Date().toISOString().split("T")[0];
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id, name, start_date, max_members, current_members")
    .eq("program_id", program.id)
    .in("status", ["upcoming", "active"])
    .gte("start_date", todayStr)
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Resume: nếu user đã có pending order cho program này, mở thẳng QR view.
  const service = createServiceClient();
  const { data: pendingOrder } = await service
    .from("orders")
    .select("id, amount, payment_code, payment_status")
    .eq("user_id", user.id)
    .eq("program", slug)
    .eq("payment_status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
