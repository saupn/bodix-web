/**
 * Dữ liệu phiên dùng chung cho (dashboard)/layout.tsx và các page bên dưới.
 *
 * Bọc bằng React cache(): trong CÙNG một request render, layout và page gọi
 * lại sẽ dùng chung kết quả (không gọi auth/DB lần hai). Cache chỉ sống trong
 * một request – không bao giờ chia sẻ giữa các user.
 *
 * Chỉ dùng trong Server Components. Route handler (app/api/**) không có
 * request scope của React nên cache() không memo ở đó – đừng dùng file này
 * trong API route.
 */
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { StatusEnrollment } from "@/lib/user/status";

/** Supabase client theo session (RLS) – một instance cho mỗi request. */
export const getRequestSupabase = cache(async () => createClient());

/** auth.getUser() đúng 1 lần mỗi request (gọi Supabase Auth để xác thực JWT). */
export const getAuthUser = cache(async () => {
  const supabase = await getRequestSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export interface DashboardProfile {
  full_name: string | null;
  trial_ends_at: string | null;
  onboarding_completed: boolean | null;
  payment_status: string | null;
  bodix_program: string | null;
  role: string | null;
  phone_verified: boolean | null;
}

/** Profile của chính user (service client, lọc theo id – giống layout cũ). */
export const getDashboardProfile = cache(async (userId: string) => {
  const service = createServiceClient();
  const { data, error } = await service
    .from("profiles")
    .select(
      "full_name, trial_ends_at, onboarding_completed, payment_status, bodix_program, role, phone_verified"
    )
    .eq("id", userId)
    .single();
  return { profile: (data as DashboardProfile | null) ?? null, error };
});

export interface DashboardEnrollment extends StatusEnrollment {
  current_day: number | null;
  program: { slug: string; name: string; duration_days: number } | null;
  cohort: { status: string; start_date: string; end_date: string | null } | null;
}

/** Mọi enrollment (trừ dropped) của user, mới nhất trước. */
export const getDashboardEnrollments = cache(async (userId: string) => {
  const supabase = await getRequestSupabase();
  const { data } = await supabase
    .from("enrollments")
    .select(
      `id, status, program_id, cohort_id, started_at, completed_at, current_day,
       program:programs (slug, name, duration_days),
       cohort:cohorts (status, start_date, end_date)`
    )
    .eq("user_id", userId)
    .not("status", "eq", "dropped")
    .order("enrolled_at", { ascending: false });
  return (data ?? []) as unknown as DashboardEnrollment[];
});
