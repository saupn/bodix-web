import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckoutSuccessClient } from "@/components/checkout/CheckoutSuccessClient";

const VALID_SLUGS = ["bodix-21", "bodix-6w", "bodix-12w"] as const;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;

  if (!slug || !VALID_SLUGS.includes(slug as (typeof VALID_SLUGS)[number])) {
    redirect("/app");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: program } = await supabase
    .from("programs")
    .select("id, name, slug")
    .eq("slug", slug)
    .single();

  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id, name, start_date")
    .eq("program_id", program?.id ?? "")
    .in("status", ["upcoming", "active"])
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  const programName = program?.name ?? "chương trình";
  const cohortName = cohort?.name ?? "Đợt sắp tới";
  const startDate = cohort?.start_date
    ? formatDate(cohort.start_date)
    : "Sẽ được thông báo";

  return (
    <CheckoutSuccessClient
      programName={programName}
      cohortName={cohortName}
      startDate={startDate}
    />
  );
}
