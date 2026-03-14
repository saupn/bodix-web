import { createServiceClient } from "@/lib/supabase/service";

/**
 * Lấy access_token từ bảng zalo_tokens trong Supabase.
 * Dùng cho Zalo OA API.
 */
export async function getAccessToken(): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("zalo_tokens")
    .select("access_token")
    .eq("id", 1)
    .single();

  if (error || !data?.access_token) {
    throw new Error(
      error?.message ?? "zalo_tokens: access_token not found for id=1"
    );
  }

  return data.access_token;
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
