import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const cohortId = request.nextUrl.searchParams.get("cohort_id");
  if (!cohortId) {
    return NextResponse.json({ error: "Thiếu cohort_id." }, { status: 400 });
  }

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("cohort_id", cohortId)
    .in("status", ["active", "completed"])
    .maybeSingle();

  if (!enrollment) {
    return NextResponse.json({ error: "Bạn không thuộc cohort này." }, { status: 403 });
  }

  const { count, error } = await supabase
    .from("community_posts")
    .select("*", { count: "exact", head: true })
    .eq("cohort_id", cohortId)
    .eq("is_hidden", false);

  if (error) {
    console.error("[community/posts/summary] GET:", error);
    return NextResponse.json({ error: "Lỗi truy vấn." }, { status: 500 });
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const iso = sevenDaysAgo.toISOString();

  const { count: newCount, error: newError } = await supabase
    .from("community_posts")
    .select("*", { count: "exact", head: true })
    .eq("cohort_id", cohortId)
    .eq("is_hidden", false)
    .gte("created_at", iso);

  if (newError) {
    return NextResponse.json({ count: count ?? 0, new_in_7d: count ?? 0 });
  }

  return NextResponse.json({
    count: count ?? 0,
    new_in_7d: newCount ?? 0,
  });
}
