import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";

// GET: Danh sách câu hỏi (filter by cohort, week, category, status)
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if ("error" in admin) return admin.error;

  const { searchParams } = new URL(request.url);
  const cohortId = searchParams.get("cohort_id");
  const week = searchParams.get("week");
  const category = searchParams.get("category");
  const status = searchParams.get("status");

  const supabase = createServiceClient();

  let query = supabase
    .from("user_questions")
    .select("*, profiles!user_id(full_name, channel_user_id)")
    .order("created_at", { ascending: false });

  if (cohortId) query = query.eq("cohort_id", cohortId);
  if (week) query = query.eq("week_number", parseInt(week));
  if (category) query = query.eq("category", category);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ questions: data });
}

// PATCH: Update status, admin_notes
export async function PATCH(request: NextRequest) {
  const admin = await verifyAdmin();
  if ("error" in admin) return admin.error;

  const body = await request.json();
  const { id, status, admin_notes } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing question id" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status;
  if (admin_notes !== undefined) updateData.admin_notes = admin_notes;

  const { error } = await supabase
    .from("user_questions")
    .update(updateData)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
