import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const verified = await verifyAdmin();
  if (verified.error) return verified.error;

  let body: { enrollment_id: string; message: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { enrollment_id, message } = body;
  if (!enrollment_id || !message?.trim()) {
    return NextResponse.json(
      { error: "Thiếu enrollment_id hoặc message." },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const { data: enrollment, error: enrollError } = await supabase
    .from("enrollments")
    .select("id, user_id")
    .eq("id", enrollment_id)
    .eq("status", "active")
    .single();

  if (enrollError || !enrollment) {
    return NextResponse.json(
      { error: "Enrollment không tồn tại hoặc không active." },
      { status: 404 }
    );
  }

  const { error: insertError } = await supabase.from("rescue_interventions").insert({
    enrollment_id: enrollment.id,
    user_id: enrollment.user_id,
    trigger_reason: "manual_coach",
    action_taken: "coach_intervention",
    message_sent: message.trim(),
    outcome: "pending",
  });

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 }
    );
  }

  // TODO: Gửi notification/email thực tế tới user
  // For now we just log the intervention

  return NextResponse.json({ ok: true });
}
