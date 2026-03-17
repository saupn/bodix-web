import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { sendMessage } from "@/lib/messaging";

// POST: Trả lời riêng cho user qua OA 1:1
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if ("error" in admin) return admin.error;

  const body = await request.json();
  const { question_id, reply_text } = body;

  if (!question_id || !reply_text) {
    return NextResponse.json({ error: "Missing question_id or reply_text" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Lấy thông tin câu hỏi + profile user
  const { data: question, error: qError } = await supabase
    .from("user_questions")
    .select("*, profiles!user_id(id, full_name, channel_user_id, preferred_channel)")
    .eq("id", question_id)
    .single();

  if (qError || !question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const profile = question.profiles as { id: string; full_name: string; channel_user_id: string; preferred_channel: string };

  if (!profile?.channel_user_id) {
    return NextResponse.json({ error: "User has no channel_user_id" }, { status: 400 });
  }

  const displayName = profile.full_name || "Bạn";
  const messageText = `Chào ${displayName}! Đây là trả lời cho câu hỏi của bạn:\n\n${reply_text}\n\nNếu còn thắc mắc, cứ nhắn mình nhé!`;

  await sendMessage({
    userId: profile.id,
    channel: (profile.preferred_channel as "zalo") || "zalo",
    channelUserId: profile.channel_user_id,
    text: messageText,
  });

  // Update status
  await supabase
    .from("user_questions")
    .update({ status: "answered_direct", admin_notes: reply_text })
    .eq("id", question_id);

  return NextResponse.json({ ok: true });
}
