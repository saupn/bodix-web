import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return data?.role === "admin";
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  if (!(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const search = params.get("search")?.trim().toLowerCase();
  const statusFilter = params.get("status");
  const programFilter = params.get("program");
  const page = Math.max(0, parseInt(params.get("page") ?? "0", 10));
  const limit = 50;

  const service = createServiceClient();

  const { data: profiles, error: profileError } = await service
    .from("profiles")
    .select("id, full_name, phone, created_at")
    .order("created_at", { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (profileError || !profiles?.length) {
    return NextResponse.json({ users: [], page, has_more: false });
  }

  const userIds = profiles.map((p) => p.id);

  const { data: enrollments } = await service
    .from("enrollments")
    .select("id, user_id, status, program_id, cohort_id, enrolled_at, programs!inner(slug, name), cohorts(name)")
    .in("user_id", userIds)
    .order("enrolled_at", { ascending: false });

  const enrollmentIds = (enrollments ?? []).map((e: { id: string }) => e.id);
  const { data: streaksData } = enrollmentIds.length
    ? await service.from("streaks").select("enrollment_id, current_streak").in("enrollment_id", enrollmentIds)
    : { data: [] };

  const emailMap = new Map<string, string>();
  try {
    const { data: authData } = await service.auth.admin.listUsers({ perPage: 1000 });
    for (const u of authData?.users ?? []) {
      if (u.email) emailMap.set(u.id, u.email);
    }
  } catch {
    // Fallback: email may be unavailable
  }

  const enrollmentsByUser = new Map<string, (typeof enrollments)>();
  for (const e of enrollments ?? []) {
    const uid = (e as { user_id: string }).user_id;
    if (!enrollmentsByUser.has(uid)) enrollmentsByUser.set(uid, []);
    enrollmentsByUser.get(uid)!.push(e);
  }

  const streakByEnrollment = new Map((streaksData ?? []).map((s: { enrollment_id: string; current_streak: number }) => [s.enrollment_id, s.current_streak]));

  const activeEnrollmentIds = (enrollments ?? []).filter((e: { status: string }) => e.status === "active").map((e: { id: string }) => e.id);
  const riskResults = await Promise.allSettled(
    activeEnrollmentIds.map((eid: string) =>
      service.rpc("calculate_risk_score", { p_enrollment_id: eid }).then((r) => ({ id: eid, score: (r.data as number) ?? 0 }))
    )
  );
  const riskByEnrollment = new Map<string, number>();
  for (const r of riskResults) {
    if (r.status === "fulfilled") riskByEnrollment.set(r.value.id, r.value.score);
  }

  let rows = profiles.map((p) => {
    const userEnrollments = enrollmentsByUser.get(p.id) ?? [];
    const activeEnrollment = userEnrollments.find((e: { status: string }) => e.status === "active" || e.status === "completed");
    const prog = activeEnrollment?.programs as unknown as { slug: string; name: string } | null;
    const cohort = activeEnrollment?.cohorts as unknown as { name: string } | null;
    const enrollmentId = activeEnrollment?.id;
    const streak = enrollmentId ? (streakByEnrollment.get(enrollmentId) ?? 0) : 0;
    const risk = enrollmentId ? (riskByEnrollment.get(enrollmentId) ?? 0) : 0;

    return {
      id: p.id,
      full_name: p.full_name ?? "–",
      email: emailMap.get(p.id) ?? "–",
      phone: p.phone ?? "–",
      status: activeEnrollment?.status ?? (userEnrollments.length ? "inactive" : "–"),
      program: prog?.name ?? "–",
      cohort: cohort?.name ?? "–",
      streak,
      risk,
      joined: p.created_at,
    };
  });

  if (search) {
    const q = search;
    rows = rows.filter(
      (r) =>
        (r.full_name ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.phone ?? "").replace(/\s/g, "").includes(q.replace(/\s/g, ""))
    );
  }
  if (statusFilter) {
    rows = rows.filter((r) => r.status === statusFilter);
  }
  if (programFilter) {
    rows = rows.filter((r) => (r.program ?? "").toLowerCase().includes(programFilter.toLowerCase()));
  }

  return NextResponse.json({
    users: rows,
    page,
    has_more: profiles.length === limit,
  });
}
