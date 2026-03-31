import { createServiceClient } from "@/lib/supabase/service";

const REFRESH_BUFFER_MS = 60 * 60 * 1000; // 1 hour

/**
 * Lấy access_token từ bảng zalo_tokens trong Supabase.
 * Nếu token hết hạn trong < 1h → tự động refresh trước khi trả về.
 */
export async function getAccessToken(): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("zalo_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("id", 1)
    .single();

  if (error || !data?.access_token) {
    throw new Error(
      error?.message ?? "zalo_tokens: access_token not found for id=1"
    );
  }

  // Check if token expires within 1 hour
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  const needsRefresh = expiresAt - Date.now() < REFRESH_BUFFER_MS;

  if (needsRefresh && data.refresh_token) {
    const refreshed = await refreshZaloToken(supabase, data.refresh_token);
    if (refreshed) return refreshed;
  }

  return data.access_token;
}

async function refreshZaloToken(
  supabase: ReturnType<typeof createServiceClient>,
  refreshToken: string
): Promise<string | null> {
  const appId = process.env.ZALO_APP_ID;
  const appSecret = process.env.ZALO_APP_SECRET;

  if (!appId || !appSecret) {
    console.error("[zalo-refresh] ZALO_APP_ID or ZALO_APP_SECRET not configured");
    return null;
  }

  try {
    const res = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        secret_key: appSecret,
      },
      body: new URLSearchParams({
        app_id: appId,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const data = await res.json();

    if (!data.access_token) {
      console.error("[zalo-refresh] Failed:", data);
      return null;
    }

    const expiresAt = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();

    await supabase
      .from("zalo_tokens")
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    return data.access_token;
  } catch (err) {
    console.error("[zalo-refresh] Error:", err);
    return null;
  }
}

/**
 * Format số điện thoại VN sang dạng quốc tế.
 * Input: "0909123456" → Output: "84909123456"
 */
export function formatPhoneVN(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  // Đã có format 84
  if (digits.startsWith("84") && digits.length === 11) {
    return digits;
  }

  // Format VN: 0xxxxxxxxx (10 số)
  if (digits.startsWith("0") && digits.length === 10) {
    return "84" + digits.slice(1);
  }

  // 9 số không có 0 đầu (84 + 9 số)
  if (digits.length === 9 && /^[35789]/.test(digits)) {
    return "84" + digits;
  }

  throw new Error(
    `Invalid Vietnam phone: ${phone}. Expected 10 digits starting with 0, or 9 digits starting with 3/5/7/8/9.`
  );
}
