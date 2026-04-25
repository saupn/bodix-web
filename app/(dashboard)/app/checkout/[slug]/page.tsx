import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckoutContent } from "@/components/checkout/CheckoutContent";

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
    .select("full_name, phone")
    .eq("id", user.id)
    .single();

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
      />
    </div>
  );
}
