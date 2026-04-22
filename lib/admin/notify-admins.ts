import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendFcmMessage, type PushPayload } from "@/lib/messaging/adapters/push";

/**
 * Bắn FCM push tới tất cả admin có fcm_token.
 * Best-effort — log lỗi và tiếp tục, không throw.
 * Trả về số push gửi thành công / thất bại.
 */
export async function notifyAdmins(payload: PushPayload): Promise<{
  sent: number;
  errors: number;
  total: number;
}> {
  const { data: admins, error } = await supabaseAdmin
    .from("profiles")
    .select("id, fcm_token")
    .eq("role", "admin")
    .not("fcm_token", "is", null);

  if (error) {
    console.error("[notify-admins] fetch admins failed:", error.message);
    return { sent: 0, errors: 0, total: 0 };
  }

  const targets = (admins ?? []).filter(
    (a): a is { id: string; fcm_token: string } => Boolean(a.fcm_token),
  );

  if (!targets.length) {
    return { sent: 0, errors: 0, total: 0 };
  }

  let sent = 0;
  let errors = 0;

  await Promise.all(
    targets.map(async (admin) => {
      const result = await sendFcmMessage(admin.fcm_token, payload, admin.id);
      if (result.success) {
        sent++;
      } else {
        errors++;
        console.error(
          "[notify-admins] FCM error for admin",
          admin.id,
          ":",
          result.error,
        );
      }
    }),
  );

  return { sent, errors, total: targets.length };
}
