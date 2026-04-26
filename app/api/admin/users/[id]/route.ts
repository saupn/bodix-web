import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return data?.role === "admin";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  if (!(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }

  const { id: userId } = await params;
  const service = createServiceClient();

  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("id, full_name, phone, created_at")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "User không tồn tại." }, { status: 404 });
  }

  let email = "–";
  try {
    const { data: authUser } = await service.auth.admin.getUserById(userId);
    if (authUser?.user?.email) email = authUser.user.email;
  } catch {
    // ignore
  }

  const { data: enrollments } = await service
    .from("enrollments")
    .select("id, status, current_day, program_id, cohort_id, programs(name), cohorts(name)")
    .eq("user_id", userId)
    .order("enrolled_at", { ascending: false });

  const enrollmentIds = (enrollments ?? []).map((e: { id: string }) => e.id);
  const { data: streaks } = enrollmentIds.length
    ? await service.from("streaks").select("enrollment_id, current_streak").in("enrollment_id", enrollmentIds)
    : { data: [] };

  const streakMap = new Map((streaks ?? []).map((s: { enrollment_id: string; current_streak: number }) => [s.enrollment_id, s.current_streak]));

  const riskResults = await Promise.allSettled(
    enrollmentIds.map((eid: string) =>
      service.rpc("calculate_risk_score", { p_enrollment_id: eid }).then((r) => ({ id: eid, score: (r.data as number) ?? 0 }))
    )
  );
  const riskMap = new Map<string, number>();
  for (const r of riskResults) {
    if (r.status === "fulfilled") riskMap.set(r.value.id, r.value.score);
  }

  const enrollmentsList = (enrollments as unknown as Array<{ id: string; status: string; current_day: number; programs: { name: string } | null; cohorts: { name: string } | null }>).map((e) => ({
    status: e.status,
    program: (e.programs as { name: string })?.name ?? "–",
    cohort: (e.cohorts as { name: string })?.name ?? "–",
    day: e.current_day ?? 0,
    streak: streakMap.get(e.id) ?? 0,
    risk: riskMap.get(e.id) ?? 0,
  }));

  return NextResponse.json({
    id: profile.id,
    full_name: profile.full_name ?? "–",
    email,
    phone: profile.phone ?? "–",
    joined: profile.created_at,
    enrollments: enrollmentsList,
  });
}
