/**
 * Dual-URL commission context (Cách 1.5).
 *
 * 1 referral code được dùng qua 2 URL khác nhau:
 *   /r/CODE  → cookie code_context='referral'  → referral voucher cho referrer
 *   /af/CODE → cookie code_context='affiliate' → affiliate cash commission
 *
 * Cookie được set ở landing (CommissionContextSetter). checkout/create đọc context
 * này để "đóng băng" loại commission lên enrollment.commission_program_type — vì
 * SePay webhook chạy server-to-server, không thấy cookie của user.
 *
 * QUY TẮC: 1 conversion → tối đa 1 commission. Không context + không code → không
 * tạo commission gì cả.
 */

export type CommissionProgramType = "referral" | "affiliate";

export type CommissionContext = {
  code: string;
  type: CommissionProgramType;
} | null;

/** Tên cookie — set bởi CommissionContextSetter trên /r/ và /af/. */
export const COMMISSION_CODE_COOKIE = "referral_code";
export const COMMISSION_CONTEXT_COOKIE = "code_context";

/** Cookie store tối thiểu (NextRequest.cookies / next/headers cookies()). */
interface ReadableCookies {
  get(name: string): { value: string } | undefined;
}

export function readCommissionContext(cookies: ReadableCookies): CommissionContext {
  const code = cookies.get(COMMISSION_CODE_COOKIE)?.value?.trim();
  const type = cookies.get(COMMISSION_CONTEXT_COOKIE)?.value?.trim() as
    | CommissionProgramType
    | undefined;

  if (!code || (type !== "referral" && type !== "affiliate")) return null;
  return { code, type };
}
