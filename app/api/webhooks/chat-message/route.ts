import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/admin/notify-admins";

/**
 * Supabase Database Webhook handler — INSERT trên `chat_messages`.
 *
 * Trigger setup: migration 044 (pg_net) hoặc Supabase Dashboard → Database
 * Webhooks → POST tới URL này với header `Authorization: Bearer <CRON_SECRET>`.
 *
 * Chỉ bắn push admin nếu:
 *   - channel_type = 'support'
 *   - sender ∉ {'admin', 'system'}  (tránh feedback loop & internal messages)
 */
interface ChatMessageRow {
  id: string;
  user_id: string | null;
  sender: string | null;
  channel_type: string | null;
  content: string | null;
}

interface SupabaseWebhookPayload {
  type?: string;
  table?: string;
  record?: ChatMessageRow;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: SupabaseWebhookPayload;
  try {
    payload = (await request.json()) as SupabaseWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.type !== "INSERT" || !payload.record) {
    return NextResponse.json({ skipped: "not_insert" });
  }

  const msg = payload.record;

  if (msg.channel_type !== "support") {
    return NextResponse.json({ skipped: "not_support" });
  }
  if (msg.sender === "admin" || msg.sender === "system") {
    return NextResponse.json({ skipped: "internal_sender" });
  }
  if (!msg.user_id) {
    return NextResponse.json({ skipped: "no_user_id" });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", msg.user_id)
    .maybeSingle();

  const userName = profile?.full_name?.trim() || "User";
  const content = msg.content?.trim() ?? "";
  const body = content.length > 100 ? `${content.slice(0, 100)}…` : content;

  const result = await notifyAdmins({
    type: "system",
    title: `Tin nhắn từ ${userName}`,
    body: body || "(tin nhắn rỗng)",
    data: {
      kind: "support_message",
      user_id: msg.user_id,
      message_id: msg.id,
    },
  });

  return NextResponse.json({ ok: true, ...result });
}
