import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const TOP_N = 5;

function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

/**
 * Returns top N buddy candidates in current user's cohort, ranked by:
 *   1. same gender (matches first), and
 *   2. closest age proximity (smallest |Δage|).
 *
 * Excludes:
 *   - users already in a buddy_pairs row for this cohort (active)
 *   - the requesting user themselves
 *
 * Cohort gating: user must have an enrollment in 'active' or
 * 'paid_waiting_cohort' status with a cohort_id.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const { data: myEnrollment } = await supabase
    .from("enrollments")
    .select("id, cohort_id")
    .eq("user_id", user.id)
    .in("status", ["active", "paid_waiting_cohort"])
    .order("enrolled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!myEnrollment?.cohort_id) {
    return NextResponse.json({ candidates: [] });
  }

  const service = createServiceClient();

  // My profile (DOB + gender) for ranking
  const { data: myProfile } = await service
    .from("profiles")
    .select("date_of_birth, gender")
    .eq("id", user.id)
    .single();

  const myAge = calcAge(myProfile?.date_of_birth ?? null);
  const myGender = myProfile?.gender ?? null;

  // All other enrollments in this cohort (active or paid_waiting_cohort)
  const { data: cohortEnrollments } = await service
    .from("enrollments")
    .select("user_id")
    .eq("cohort_id", myEnrollment.cohort_id)
    .in("status", ["active", "paid_waiting_cohort"])
    .neq("user_id", user.id);

  if (!cohortEnrollments?.length) {
    return NextResponse.json({ candidates: [] });
  }

  const cohortUserIds = cohortEnrollments.map((e) => e.user_id);

  // Exclude users already paired in this cohort
  const { data: existingPairs } = await service
    .from("buddy_pairs")
    .select("user_a, user_b")
    .eq("cohort_id", myEnrollment.cohort_id)
    .eq("status", "active");

  const pairedUserIds = new Set<string>();
  for (const p of existingPairs ?? []) {
    pairedUserIds.add(p.user_a);
    pairedUserIds.add(p.user_b);
  }

  const availableIds = cohortUserIds.filter((id) => !pairedUserIds.has(id));
  if (availableIds.length === 0) {
    return NextResponse.json({ candidates: [] });
  }

  // Fetch candidate profiles
  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name, date_of_birth, gender")
    .in("id", availableIds);

  type Ranked = {
    id: string;
    name: string | null;
    age: number | null;
    gender: string | null;
    sameGender: boolean;
    ageDiff: number;
  };

  const ranked: Ranked[] = (profiles ?? []).map((p) => {
    const age = calcAge(p.date_of_birth);
    const sameGender =
      myGender !== null && p.gender !== null && p.gender === myGender;
    const ageDiff =
      myAge !== null && age !== null ? Math.abs(age - myAge) : 999;
    return {
      id: p.id,
      name: p.full_name,
      age,
      gender: p.gender,
      sameGender,
      ageDiff,
    };
  });

  // Sort: same-gender first, then smallest age diff. Unknown age sinks last.
  ranked.sort((a, b) => {
    if (a.sameGender !== b.sameGender) return a.sameGender ? -1 : 1;
    return a.ageDiff - b.ageDiff;
  });

  const top = ranked.slice(0, TOP_N).map((r) => ({
    id: r.id,
    name: r.name,
    age: r.age,
  }));

  return NextResponse.json({ candidates: top });
}
