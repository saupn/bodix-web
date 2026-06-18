import { createServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Một user là affiliate khi dòng referral_codes (duy nhất sau dedup — UNIQUE(user_id))
 * của họ có is_affiliate = true.
 *
 * KHÔNG dùng channel_user_id. KHÔNG lọc code_type (mã chung cho cả referral + affiliate).
 *
 * Dùng cho luồng tặng sách: affiliate gửi link không giới hạn (bỏ qua quota gift_remaining).
 */
export async function isAffiliate(
  service: ServiceClient,
  userId: string,
): Promise<boolean> {
  const { data } = await service
    .from("referral_codes")
    .select("is_affiliate")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.is_affiliate === true;
}
