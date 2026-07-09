import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Hộp thư tâm sự sau tin rescue — Founder trả lời TAY qua Zalo OA Manager,
 * trang này chỉ để không sót ai và đánh dấu đã xử lý.
 *
 * GET  ?status=needs_founder_reply|resolved|all  → danh sách tin
 * PATCH { id, status }                           → đánh dấu resolved / mở lại
 */

const VALID_STATUS = ["needs_founder_reply", "resolved"] as const;
type ReplyStatus = (typeof VALID_STATUS)[number];

export async function GET(request: NextRequest) {
  const verified = await verifyAdmin();
  if (verified.error) return verified.error;

  const status = request.nextUrl.searchParams.get("status") ?? "needs_founder_reply";
  const supabase = createServiceClient();

  // profiles bị tham chiếu 2 lần (user_id, resolved_by) → phải chỉ đích danh FK.
  let query = supabase
    .from("rescue_replies")
    .select(
      `id, message_text, received_at, status, resolved_at,
       profiles!rescue_replies_user_id_fkey (full_name, phone, channel_user_id)`
    )
    .order("received_at", { ascending: false })
    .limit(200);

  if (status !== "all") {
    if (!VALID_STATUS.includes(status as ReplyStatus)) {
      return NextResponse.json({ error: "status không hợp lệ." }, { status: 400 });
    }
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ replies: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const verified = await verifyAdmin();
  if (verified.error) return verified.error;

  let body: { id?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { id, status } = body;
  if (!id || !status || !VALID_STATUS.includes(status as ReplyStatus)) {
    return NextResponse.json(
      { error: "Thiếu id hoặc status không hợp lệ." },
      { status: 400 }
    );
  }

  const resolved = status === "resolved";
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("rescue_replies")
    .update({
      status,
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by: resolved ? verified.user.id : null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
