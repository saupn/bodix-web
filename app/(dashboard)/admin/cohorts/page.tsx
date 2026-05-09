import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CohortsList } from "./cohorts-list";

export const dynamic = "force-dynamic";

export default async function AdminCohortsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/app");

  const service = createServiceClient();

  const { data: cohorts } = await service
    .from("cohorts")
    .select(
      "id, name, start_date, end_date, status, current_members, max_members, program_id, programs(name, slug)",
    )
    .order("start_date", { ascending: false });

  const { data: programs } = await service
    .from("programs")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("price_vnd", { ascending: true });

  const { data: usersWaiting } = await service
    .from("profiles")
    .select("id, full_name, phone, bodix_program, payment_status")
    .eq("bodix_status", "paid_waiting_cohort")
    .order("full_name", { ascending: true });

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin" className="text-sm text-primary hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-3 font-heading text-2xl font-bold text-primary">
          Quản lý Cohort
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Tạo đợt tập, gán users đang chờ và bắt đầu cohort.
        </p>

        <CohortsList
          cohorts={cohorts ?? []}
          programs={programs ?? []}
          usersWaiting={usersWaiting ?? []}
        />
      </div>
    </div>
  );
}
