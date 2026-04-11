import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** Đợt tập (cohort) upcoming sớm nhất — dùng cho trang chủ */
export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("cohorts")
    .select("name, start_date")
    .eq("status", "upcoming")
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[cohorts/upcoming]", error);
    return NextResponse.json({ cohort: null }, { status: 500 });
  }

  return NextResponse.json({ cohort: data });
}
