import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { sendFcmMessage } from "@/lib/messaging/adapters/push";

/**
 * Admin gửi trả lời tới BodiX Support chat của 1 user.
 *
 * Body: { user_id: string, content: string, channel_type?: 'support' }
 *
 * Ghi vào `chat_messages` với sender='admin', channel_type='support'.
 * Supabase Realtime → app users (nếu online) nhận ngay.
 * Đồng thời bắn FCM push type='chatMessage' để user thấy notification
 * khi app đang background.
 */
export async function POST(request: NextRequest) {
  const verified = await verifyAdmin();
  if (verified.error) return verified.error;

  let body: { user_id?: string; content?: string; channel_type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const userId = body.user_id;
  const content = body.content?.trim();
  const channelType = body.channel_type ?? "support";

  if (!userId || !content) {
    return NextResponse.json(
      { error: "Thiếu user_id hoặc content." },
      { status: 400 }
    );
  }

  if (channelType !== "support") {
    return NextResponse.json(
      { error: "channel_type chỉ hỗ trợ 'support' ở endpoint này." },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, fcm_token, notification_via")
    .eq("id", userId)
    .maybeSingle();

  if (profileErr || !profile) {
    return NextResponse.json(
      { error: "User không tồn tại." },
      { status: 404 }
    );
  }

  // Insert — Supabase Realtime sẽ push tới app listeners tự động.
  const { data: message, error: insertErr } = await supabase
    .from("chat_messages")
    .insert({
      user_id: profile.id,
      sender: "admin",
      channel_type: "support",
      channel_id: null,
      message_type: "text",
      content,
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json(
      { error: insertErr.message },
      { status: 500 }
    );
  }

  // Best-effort FCM push cho user khi app offline/background.
  // Không block response — nếu push fail, tin nhắn đã ghi DB + realtime đã bắn.
  if (profile.fcm_token) {
    try {
      await sendFcmMessage(
        profile.fcm_token,
        {
          type: "chatMessage",
          title: "BodiX Support",
          body: content.length > 120 ? `${content.slice(0, 120)}…` : content,
          data: {
            channel_type: "support",
            message_id: message.id,
          },
        },
        profile.id
      );
    } catch (err) {
      console.error("[admin/chat/reply] FCM failed:", err);
    }
  }

  return NextResponse.json({ ok: true, message });
}
