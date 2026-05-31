/**
 * Affiliate commission helper — V2 cooldown flow.
 *
 * Status flow:
 *   pending → payable (referee active + ≥1 check-in)
 *   pending → cancelled (timeout / dropped / no_checkin_after_active)
 *   payable → paid (admin payout — out of scope task này)
 *
 * KHÔNG xoá row khi cancel. status_history log mọi transition.
 *
 * Refactor BD-REFERRAL-VOUCHER-FLOW: transition logic dùng chung shell
 * `lib/commissions/base-transition.ts` (shared shell, custom kernel). Affiliate
 * dùng default kernel (chỉ update status='payable'). Referral có kernel riêng
 * để tạo voucher trước. createAffiliateCommission GIỮ NGUYÊN signature + behaviour.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AFFILIATE_COMMISSION_RATE,
  AFFILIATE_PENDING_TIMEOUT_DAYS,
  AFFILIATE_NO_CHECKIN_TIMEOUT_DAYS,
  AFFILIATE_SUSPICIOUS_THRESHOLD,
} from "./config";
import {
  appendHistory,
  cancelCommission as baseCancelCommission,
  transitionCommissionsBase,
  type CommissionRow,
  type StatusHistoryEntry,
  type TransitionStats,
} from "@/lib/commissions/base-transition";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Service = SupabaseClient<any, any, any>;

// ────────────────────────────────────────────────────────────────────────────
// CREATE — gọi từ SePay webhook (sau khi enrollment → paid_waiting_cohort)
// và từ checkout/confirm (mock payment).
// ────────────────────────────────────────────────────────────────────────────

interface CreateCommissionInput {
  /** referral_codes.id (FK đã có trên enrollment.referral_code_id) */
  referralCodeId: string;
  /** profiles.id của user vừa mua */
  refereeUserId: string;
  /** enrollments.id vừa được set paid_waiting_cohort */
  enrollmentId: string;
  /** orders.id (BIGINT) — null cho mock checkout/confirm */
  orderId: number | null;
  /** Số tiền thực tế khách trả (sau giảm giá), VND */
  conversionAmountVnd: number;
  /** Optional metadata */
  sourceUrl?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  /**
   * Dual-URL (Cách 1.5): khi caller đã quyết định loại commission từ context
   * URL (enrollment.commission_program_type='affiliate'), bỏ qua guard code_type.
   * Cho phép code_type='referral' tạo affiliate commission khi user vào qua /af/.
   */
  contextOverride?: boolean;
}

/**
 * Tạo commission row với status='pending'.
 * - Nếu code KHÔNG phải code_type='affiliate' → skip (referral xử lý task riêng).
 * - Self-referral guard.
 * - Trả về commission row hoặc null nếu skip.
 */
export async function createAffiliateCommission(
  service: Service,
  input: CreateCommissionInput,
): Promise<{ id: string; status: string } | null> {
  const { data: code, error: codeErr } = await service
    .from("referral_codes")
    .select("id, user_id, code, code_type, commission_rate, is_affiliate")
    .eq("id", input.referralCodeId)
    .maybeSingle();

  if (codeErr || !code) {
    console.warn("[commission.create] referral_codes lookup failed:", codeErr ?? "not found");
    return null;
  }

  // Task này chỉ implement affiliate. Referral voucher flow làm task riêng.
  // contextOverride: caller đã resolve loại commission từ context URL (/af/) →
  // bỏ qua guard để code_type='referral' vẫn tạo được affiliate commission.
  if (!input.contextOverride && code.code_type !== "affiliate" && !code.is_affiliate) {
    return null;
  }

  // Self-referral guard (DB constraint cũng bắt, nhưng skip sớm để khỏi noise log)
  if (code.user_id === input.refereeUserId) {
    console.warn(
      "[commission.create] self-referral skipped:",
      code.code,
      input.refereeUserId,
    );
    return null;
  }

  const commissionRate = code.commission_rate ?? AFFILIATE_COMMISSION_RATE;
  const commissionAmount = Math.round(
    input.conversionAmountVnd * (Number(commissionRate) / 100),
  );

  if (commissionAmount <= 0) {
    console.warn(
      "[commission.create] zero commission skipped:",
      input.conversionAmountVnd,
      commissionRate,
    );
    return null;
  }

  const now = new Date();
  const pendingExpiresAt = new Date(
    now.getTime() + AFFILIATE_PENDING_TIMEOUT_DAYS * 24 * 60 * 60 * 1000,
  );

  const initialHistory: StatusHistoryEntry[] = [
    { at: now.toISOString(), from: null, to: "pending", reason: "purchase_confirmed" },
  ];

  const { data: commission, error: insertErr } = await service
    .from("commissions")
    .insert({
      program_type: "affiliate",
      beneficiary_user_id: code.user_id,
      beneficiary_code: code.code,
      referee_user_id: input.refereeUserId,
      enrollment_id: input.enrollmentId,
      order_id: input.orderId,
      order_amount_vnd: input.conversionAmountVnd,
      reward_type: "cash_commission",
      reward_rate: commissionRate,
      reward_amount_vnd: commissionAmount,
      reward_description: `Commission ${commissionRate}% × ${Math.round(input.conversionAmountVnd / 1000)}k = ${Math.round(commissionAmount / 1000)}k`,
      status: "pending",
      purchase_at: now.toISOString(),
      pending_expires_at: pendingExpiresAt.toISOString(),
      status_history: initialHistory,
      source_url: input.sourceUrl ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    })
    .select("id, status")
    .single();

  if (insertErr) {
    console.error("[commission.create] insert failed:", insertErr);
    return null;
  }

  return commission;
}

// ────────────────────────────────────────────────────────────────────────────
// TRANSITION — gọi từ cron rescue-check.
// Xử lý mọi pending commission của affiliate program.
// Wrap shared shell — affiliate dùng default kernel (chỉ update status='payable').
// ────────────────────────────────────────────────────────────────────────────

export async function transitionAffiliateCommissions(
  service: Service,
): Promise<TransitionStats> {
  return transitionCommissionsBase(service, {
    programType: "affiliate",
    noCheckinTimeoutDays: AFFILIATE_NO_CHECKIN_TIMEOUT_DAYS,
    suspicious: {
      thresholdCount: AFFILIATE_SUSPICIOUS_THRESHOLD,
      windowDays: 7,
    },
    // onPromoteToPayable: undefined → defaultPromoteToPayable (status='payable').
  });
}

// ────────────────────────────────────────────────────────────────────────────
// MANUAL CANCEL — admin hành động (anti-fraud, manual review)
// ────────────────────────────────────────────────────────────────────────────

export async function cancelCommissionsByReferee(
  service: Service,
  refereeUserId: string,
  reason: string,
): Promise<number> {
  const { data: rows } = await service
    .from("commissions")
    .select("id, status, status_history, beneficiary_user_id, referee_user_id, enrollment_id, pending_expires_at, purchase_at")
    .eq("referee_user_id", refereeUserId)
    .in("status", ["pending", "payable"]);

  let count = 0;
  for (const row of (rows ?? []) as CommissionRow[]) {
    await baseCancelCommission(service, row, reason);
    count++;
  }
  return count;
}

// Re-export StatusHistoryEntry để giữ compat với caller cũ (nếu có).
export type { StatusHistoryEntry } from "@/lib/commissions/base-transition";
// appendHistory cũng re-export — một số nơi cần build entry custom.
export { appendHistory };
