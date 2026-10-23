import { getAuthUser, getRequestSupabase } from "@/lib/dashboard/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckoutSuccessClient } from "@/components/checkout/CheckoutSuccessClient";
import { formatDateVn } from "@/lib/date/vietnam";

const VALID_SLUGS = ["bodix-21", "bodix-6w", "bodix-12w"] as const;

const formatDate = formatDateVn;

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;

  if (!slug || !VALID_SLUGS.includes(slug as (typeof VALID_SLUGS)[number])) {
    redirect("/app");
  }

  const supabase = await getRequestSupabase();
  // getUser dùng chung với layout trong cùng request (React cache).
  const user = await getAuthUser();

  if (!user) redirect("/login");

  // Program + đợt gần nhất (lọc qua join theo slug) → song song.
  const [{ data: program }, { data: cohort }] = await Promise.all([
    supabase
      .from("programs")
      .select("id, name, slug")
      .eq("slug", slug)
      .single(),
    supabase
      .from("cohorts")
      .select("id, name, start_date, programs!inner(slug)")
      .eq("programs.slug", slug)
      .in("status", ["upcoming", "active"])
      .order("start_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

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
