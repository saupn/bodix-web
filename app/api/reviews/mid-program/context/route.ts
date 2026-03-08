import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const SIGNED_URL_TTL = 3600;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const { data: enrollment, error: enrollError } = await supabase
    .from("enrollments")
    .select("id, current_day, program_id, programs(duration_days)")
    .eq("user_id", user.id)
    .in("status", ["active", "completed"])
    .order("enrolled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (enrollError || !enrollment) {
    return NextResponse.json({
      eligible: false,
      reason: "no_enrollment",
    });
  }

  const programDays = (enrollment.programs as unknown as { duration_days: number })?.duration_days ?? 0;
  const halfwayDay = Math.ceil(programDays / 2);
  const currentDay = enrollment.current_day ?? 0;
  const windowStart = halfwayDay - 3;
  const windowEnd = halfwayDay + 7;

  if (currentDay < windowStart || currentDay > windowEnd) {
    return NextResponse.json({
      eligible: false,
      reason: "outside_window",
      current_day: currentDay,
      eligible_from: windowStart,
      eligible_until: windowEnd,
    });
  }

  const { data: existing } = await supabase
    .from("mid_program_reflections")
    .select("*")
    .eq("enrollment_id", enrollment.id)
    .maybeSingle();

  if (existing) {
    const service = createServiceClient();
    let beforeSigned: string | null = null;
    let midpointSigned: string | null = null;
    if (existing.before_photo_url) {
      const { data } = await service.storage
        .from("progress-photos")
        .createSignedUrl(existing.before_photo_url as string, SIGNED_URL_TTL);
      beforeSigned = data?.signedUrl ?? null;
    }
    if (existing.midpoint_photo_url) {
      const { data } = await service.storage
        .from("progress-photos")
        .createSignedUrl(existing.midpoint_photo_url as string, SIGNED_URL_TTL);
      midpointSigned = data?.signedUrl ?? null;
    }
    return NextResponse.json({
      eligible: true,
      submitted: true,
      enrollment_id: enrollment.id,
      current_day: currentDay,
      total_days: programDays,
      halfway_day: halfwayDay,
      existing_reflection: existing,
      before_photo_url: beforeSigned,
      midpoint_photo_url: midpointSigned,
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("fitness_goal")
    .eq("id", user.id)
    .single();

  const originalGoal = Array.isArray(profile?.fitness_goal)
    ? (profile.fitness_goal as string[]).join(", ")
    : "Chưa đặt mục tiêu";

  const halfwayWeek = Math.ceil(halfwayDay / 7);
  const service = createServiceClient();

  const { data: beforePhotos } = await service
    .from("progress_photos")
    .select("photo_url")
    .eq("enrollment_id", enrollment.id)
    .eq("photo_type", "before")
    .order("uploaded_at", { ascending: false })
    .limit(1);

  const { data: midpointPhotos } = await service
    .from("progress_photos")
    .select("photo_url")
    .eq("enrollment_id", enrollment.id)
    .eq("photo_type", "midpoint")
    .eq("week_number", halfwayWeek)
    .order("uploaded_at", { ascending: false })
    .limit(1);

  let beforeSigned: string | null = null;
  let midpointSigned: string | null = null;
  if (beforePhotos?.[0]?.photo_url) {
    const { data } = await service.storage
      .from("progress-photos")
      .createSignedUrl(beforePhotos[0].photo_url, SIGNED_URL_TTL);
    beforeSigned = data?.signedUrl ?? null;
  }
  if (midpointPhotos?.[0]?.photo_url) {
    const { data } = await service.storage
      .from("progress-photos")
      .createSignedUrl(midpointPhotos[0].photo_url, SIGNED_URL_TTL);
    midpointSigned = data?.signedUrl ?? null;
  }

  return NextResponse.json({
    eligible: true,
    submitted: false,
    enrollment_id: enrollment.id,
    current_day: currentDay,
    total_days: programDays,
    halfway_day: halfwayDay,
    halfway_week: halfwayWeek,
    original_goal: originalGoal,
    before_photo_url: beforeSigned,
    midpoint_photo_url: midpointSigned,
    before_photo_path: beforePhotos?.[0]?.photo_url ?? null,
    midpoint_photo_path: midpointPhotos?.[0]?.photo_url ?? null,
  });
}
