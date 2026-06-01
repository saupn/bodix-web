/**
 * Referral code generator — pattern + dedup.
 *
 * Pattern: lấy từ đầu + từ cuối của full_name, strip accent, uppercase.
 * Vd: "Nguyễn Văn Lan" → "NGUYENLAN", "Phạm Ngọc Sáu" → "PHAMSAU".
 *
 * Dedup: check trong referral_codes.code + profiles.referral_code; tăng suffix.
 * Fallback: pad bằng userId nếu base quá ngắn; random 6 ký tự nếu cạn suffix.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { removeDiacritics } from "./utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Service = SupabaseClient<any, any, any>;

const MIN_BASE_LENGTH = 4;
const MAX_SUFFIX = 999;

/** Lấy A-Z/0-9 từ 1 từ (đã strip accent). */
function stripToUpper(word: string): string {
  return removeDiacritics(word).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Sinh "base" theo strategy first+last word. KHÔNG dedup ở đây. */
export function buildBaseCode(fullName: string, userId: string): string {
  const cleaned = (fullName ?? "").trim();
  const words = cleaned ? cleaned.split(/\s+/).filter(Boolean) : [];

  let base = "";
  if (words.length >= 2) {
    base = stripToUpper(words[0]) + stripToUpper(words[words.length - 1]);
  } else if (words.length === 1) {
    base = stripToUpper(words[0]);
  }

  // Pad nếu base quá ngắn (tên 1 từ, tên chỉ ký tự đặc biệt, etc.)
  if (base.length < MIN_BASE_LENGTH) {
    const userSuffix = userId.replace(/-/g, "").slice(0, 6).toUpperCase();
    base = (base + userSuffix).slice(0, 12);
  }

  return base;
}

/** Check code free across referral_codes.code + profiles.referral_code. */
async function isCodeFree(service: Service, code: string): Promise<boolean> {
  const { data: takenByRefCode } = await service
    .from("referral_codes")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (takenByRefCode) return false;

  const { data: takenByProfile } = await service
    .from("profiles")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();
  return !takenByProfile;
}

/**
 * Sinh referral code unique cho user.
 * - Strategy: base = first+last word (uppercase, no accent).
 * - Dedup: base, base2, base3, ..., base999, rồi random fallback.
 * - Trả về code không trùng. Throw nếu cạn quá nhiều lần (very unlikely).
 */
export async function generateReferralCode(
  service: Service,
  fullName: string,
  userId: string,
): Promise<string> {
  const base = buildBaseCode(fullName, userId);
  if (!base) {
    throw new Error("generateReferralCode: empty base after normalize");
  }

  // Thử base trước
  if (await isCodeFree(service, base)) return base;

  // base2, base3, ..., baseN
  for (let i = 2; i <= MAX_SUFFIX; i++) {
    const candidate = `${base}${i}`;
    if (await isCodeFree(service, candidate)) return candidate;
  }

  // Cạn suffix → random 6 char (chỉ A-Z, 0-9; tránh O/0/I/1 ambiguous khi paste)
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 10; attempt++) {
    let rnd = "";
    for (let i = 0; i < 6; i++) {
      rnd += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    const candidate = `${base}${rnd}`.slice(0, 15);
    if (await isCodeFree(service, candidate)) return candidate;
  }

  throw new Error(`generateReferralCode: could not allocate code for base=${base}`);
}

/**
 * Idempotent ensure: nếu user chưa có referral_codes (code_type='referral'),
 * tạo mới với defaults; nếu đã có thì trả về row hiện tại.
 *
 * Defaults (theo BD-REFERRAL-VOUCHER-FLOW):
 *  - reward_type='credit' (semantic: voucher credit cho referrer)
 *  - reward_value=REFERRAL_REWARD_AMOUNT (100K)
 *  - referee_reward_type='discount_percent'
 *  - referee_reward_value=REFERRAL_DISCOUNT_PERCENT (10%)
 *
 * Cũng update profiles.referral_code (legacy compatibility với lookup paths
 * trong checkout/complete-onboarding fallback).
 */
export async function ensureReferralCodeForUser(
  service: Service,
  userId: string,
  fullName: string,
): Promise<{ code: string; created: boolean }> {
  // Single-source: mỗi user chỉ 1 dòng referral_codes (UNIQUE user_id).
  // KHÔNG lọc code_type — nếu user đã là affiliate, dòng đó vẫn là mã chung.
  const { data: existing } = await service
    .from("referral_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.code) {
    return { code: existing.code, created: false };
  }

  const code = await generateReferralCode(service, fullName, userId);

  // Defaults imported lazily to avoid circular import at server bootstrap.
  const { REFERRAL_REWARD_AMOUNT, REFERRAL_DISCOUNT_PERCENT } = await import(
    "@/lib/affiliate/config"
  );

  const { error: insertError } = await service
    .from("referral_codes")
    .insert({
      user_id: userId,
      code,
      code_type: "referral",
      reward_type: "credit",
      reward_value: REFERRAL_REWARD_AMOUNT,
      referee_reward_type: "discount_percent",
      referee_reward_value: REFERRAL_DISCOUNT_PERCENT,
    });

  if (insertError) {
    // Race condition: user khác vừa giành code / dòng vừa được tạo. Re-fetch.
    const { data: again } = await service
      .from("referral_codes")
      .select("code")
      .eq("user_id", userId)
      .maybeSingle();
    if (again?.code) return { code: again.code, created: false };
    throw insertError;
  }

  // Best-effort mirror lên profiles (legacy lookup paths).
  await service
    .from("profiles")
    .update({ referral_code: code })
    .eq("id", userId);

  return { code, created: true };
}
