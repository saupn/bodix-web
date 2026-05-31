import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getVietnamDateString } from "@/lib/date/vietnam";

export const dynamic = "force-dynamic";

/**
 * Đợt tập (cohort) upcoming — dùng cho trang chủ + dashboard.
 *
 * - Mặc định: trả về cohort gần nhất `{ cohort }` (giữ tương thích NextCohortBanner).
 * - `?list=1`: trả về toàn bộ cohort upcoming `{ cohorts: [...] }` để hiển thị
 *   "Còn N đợt khác". Lọc theo `?program_id=` nếu có.
 */
export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const { searchParams } = request.nextUrl;
  const wantList = searchParams.get("list") === "1";
  const programId = searchParams.get("program_id");
  const today = getVietnamDateString();

  let query = supabase
    .from("cohorts")
    .select("id, name, start_date, program_id")
    .eq("status", "upcoming")
    .gte("start_date", today)
    .order("start_date", { ascending: true });

  if (programId) query = query.eq("program_id", programId);

  if (wantList) {
    const { data, error } = await query;
    if (error) {
      console.error("[cohorts/upcoming] list", error);
      return NextResponse.json({ cohorts: [] }, { status: 500 });
    }
    return NextResponse.json({ cohorts: data ?? [] });
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) {
    console.error("[cohorts/upcoming]", error);
    return NextResponse.json({ cohort: null }, { status: 500 });
  }
  return NextResponse.json({ cohort: data });
}
