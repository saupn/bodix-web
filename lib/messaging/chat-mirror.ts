import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ghi tin nhắn system vào `chat_messages` (channel='support', sender='system')
 * để app user thấy lại trong BodiX Support chat history.
 *
 * Best-effort — callers KHÔNG cần bọc try/catch; mọi lỗi đều được log và nuốt
 * bên trong để không làm gián đoạn main nudge/cron flow.
 */
export async function insertSupportSystemMessage(
  supabase: SupabaseClient,
  userId: string,
  content: string,
): Promise<void> {
  try {
    const { error } = await supabase.from("chat_messages").insert({
      user_id: userId,
      sender: "system",
      channel_type: "support",
      channel_id: null,
      message_type: "text",
      content,
    });
    if (error) {
      console.error(
        "[chat-mirror] insertSupportSystemMessage failed:",
        userId,
        error.message,
      );
    }
  } catch (err) {
    console.error(
      "[chat-mirror] insertSupportSystemMessage threw:",
      userId,
      err,
    );
  }
}
