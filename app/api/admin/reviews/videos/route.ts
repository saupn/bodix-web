import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";

// GET: Danh sách video reviews
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if ("error" in admin) return admin.error;

  const { searchParams } = new URL(request.url);
  const cohortId = searchParams.get("cohort_id");
  const week = searchParams.get("week");

  const supabase = createServiceClient();

  let query = supabase
    .from("review_videos")
    .select("*, cohorts(id, start_date, end_date, status), programs(name, slug)")
    .order("created_at", { ascending: false });

  if (cohortId) query = query.eq("cohort_id", cohortId);
  if (week) query = query.eq("week_number", parseInt(week));

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ videos: data });
}

// POST: Tạo video review mới
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if ("error" in admin) return admin.error;

  const body = await request.json();
  const { cohort_id, program_id, week_number, video_url, title, description, topics_covered, duration_minutes } = body;

  if (!cohort_id || !week_number || !video_url || !title) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("review_videos")
    .insert({
      cohort_id,
      program_id: program_id || null,
      week_number,
      video_url,
      title,
      description: description || null,
      topics_covered: topics_covered || [],
      duration_minutes: duration_minutes || null,
      status: "draft",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ video: data });
}

// PATCH: Update video review
export async function PATCH(request: NextRequest) {
  const admin = await verifyAdmin();
  if ("error" in admin) return admin.error;

  const body = await request.json();
  const { id, ...updateFields } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing video id" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from("review_videos")
    .update(updateFields)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
