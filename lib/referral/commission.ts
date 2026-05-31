/**
 * Referral commission + voucher reward helper — BD-REFERRAL-VOUCHER-FLOW.
 *
 * Status flow (giống affiliate cooldown V2):
 *   pending → payable (referee active + ≥1 check-in) → voucher tạo, payable
 *   pending → cancelled (timeout / dropped / no_checkin_after_active)
 *
 * Khác affiliate:
 *  - reward_type='voucher' (không phải cash_commission).
 *  - onPromoteToPayable kernel TẠO voucher cho referrer trước khi update
 *    commission. Idempotent qua source_commission_id (1 commission ↔ 1 voucher).
 *  - CHO PHÉP self-referral (DB partial check + app KHÔNG block).
 *  - KHÔNG suspicious detection (referral voucher không phải dòng tiền mặt).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REFERRAL_REWARD_AMOUNT,
  AFFILIATE_PENDING_TIMEOUT_DAYS,
  AFFILIATE_NO_CHECKIN_TIMEOUT_DAYS,
} from "@/lib/affiliate/config";
import {
  appendHistory,
  defaultPromoteToPayable,
  transitionCommissionsBase,
  type CommissionRow,
  type StatusHistoryEntry,
  type TransitionStats,
} from "@/lib/commissions/base-transition";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Service = SupabaseClient<any, any, any>;

/** Voucher expiry sau khi referrer được trao thưởng (ngày). */
export const REFERRAL_VOUCHER_EXPIRY_DAYS = 90;

// ────────────────────────────────────────────────────────────────────────────
// CREATE — gọi từ SePay webhook khi enrollment paid_waiting_cohort + referral_code_id
// ────────────────────────────────────────────────────────────────────────────

interface CreateReferralCommissionInput {
  /** referral_codes.id (FK đã có trên enrollment.referral_code_id) */
  referralCodeId: string;
  /** profiles.id của user vừa mua */
  refereeUserId: string;
  /** enrollments.id vừa được set paid_waiting_cohort */
  enrollmentId: string;
  /** orders.id (BIGINT) */
  orderId: number | null;
  /** Số tiền thực tế khách trả (sau giảm giá), VND */
  conversionAmountVnd: number;
  sourceUrl?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  /**
   * Dual-URL (Cách 1.5): khi caller đã quyết định loại commission từ context
   * URL (enrollment.commission_program_type='referral'), bỏ qua guard code_type.
   * Cho phép code_type='affiliate' tạo referral voucher khi user vào qua /r/.
   */
  contextOverride?: boolean;
}

/**
 * Tạo referral commission row (status='pending', reward_type='voucher').
 * - Bỏ qua nếu code_type != 'referral' (affiliate xử lý riêng).
 * - CHO PHÉP self-referral (anh khôi phục voucher cho chính user).
 * - Idempotent: nếu commission cho enrollment_id+beneficiary đã tồn tại → skip.
 */
export async function createReferralCommission(
  service: Service,
  input: CreateReferralCommissionInput,
): Promise<{ id: string; status: string } | null> {
  const { data: code, error: codeErr } = await service
    .from("referral_codes")
    .select("id, user_id, code, code_type")
    .eq("id", input.referralCodeId)
    .maybeSingle();

  if (codeErr || !code) {
    console.warn(
      "[referral.commission.create] referral_codes lookup failed:",
      codeErr ?? "not found",
    );
    return null;
  }

  // contextOverride: caller đã resolve loại commission từ context URL (/r/) →
  // bỏ qua guard để code_type='affiliate' vẫn tạo được referral voucher.
  if (!input.contextOverride && code.code_type !== "referral") {
    // Affiliate flow handled by createAffiliateCommission separately.
    return null;
  }

  // Idempotency: 1 enrollment chỉ tạo 1 referral commission cho beneficiary.
  const { data: existing } = await service
    .from("commissions")
    .select("id, status")
    .eq("program_type", "referral")
    .eq("enrollment_id", input.enrollmentId)
    .eq("beneficiary_user_id", code.user_id)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const now = new Date();
  const pendingExpiresAt = new Date(
    now.getTime() + AFFILIATE_PENDING_TIMEOUT_DAYS * 24 * 60 * 60 * 1000,
  );

  const initialHistory: StatusHistoryEntry[] = [
    { at: now.toISOString(), from: null, to: "pending", reason: "purchase_confirmed" },
  ];

  const isSelfReferral = code.user_id === input.refereeUserId;

  const { data: commission, error: insertErr } = await service
    .from("commissions")
    .insert({
      program_type: "referral",
      beneficiary_user_id: code.user_id,
      beneficiary_code: code.code,
      referee_user_id: input.refereeUserId,
      enrollment_id: input.enrollmentId,
      order_id: input.orderId,
      order_amount_vnd: input.conversionAmountVnd,
      reward_type: "voucher",
      reward_rate: null,
      reward_amount_vnd: REFERRAL_REWARD_AMOUNT,
      reward_description: isSelfReferral
        ? `Voucher ${Math.round(REFERRAL_REWARD_AMOUNT / 1000)}k (self-referral)`
        : `Voucher ${Math.round(REFERRAL_REWARD_AMOUNT / 1000)}k cho referrer`,
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
    console.error("[referral.commission.create] insert failed:", insertErr);
    return null;
  }

  return commission;
}

// ────────────────────────────────────────────────────────────────────────────
// VOUCHER ISSUANCE (idempotent) — chạy khi commission promote → payable.
// ────────────────────────────────────────────────────────────────────────────

/** Sinh voucher code unique theo commission.id (deterministic, idempotent). */
function buildVoucherCodeForCommission(commissionId: string): string {
  // commission.id là UUID. Lấy 8 hex đầu, upper-case → "VR" + 8 chars = 10 ký tự.
  // Đủ unique trong toàn hệ (chỉ 1 commission ↔ 1 voucher; collision = bug).
  const chunk = commissionId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `VR${chunk}`;
}

/**
 * Tạo voucher 100K cho beneficiary nếu chưa có; trả về voucher row.
 * Idempotent: lookup theo source_commission_id trước.
 */
async function issueVoucherForCommission(
  service: Service,
  commission: { id: string; beneficiary_user_id: string; reward_amount_vnd: number },
  nowIso: string,
): Promise<{ id: string; code: string } | null> {
  // Idempotent check
  const { data: existing } = await service
    .from("vouchers")
    .select("id, code")
    .eq("source_commission_id", commission.id)
    .maybeSingle();

  if (existing) return existing;

  const code = buildVoucherCodeForCommission(commission.id);
  const expiresAt = new Date(
    new Date(nowIso).getTime() +
      REFERRAL_VOUCHER_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: inserted, error } = await service
    .from("vouchers")
    .insert({
      user_id: commission.beneficiary_user_id,
      code,
      voucher_type: "fixed_amount",
      amount: commission.reward_amount_vnd,
      remaining_amount: commission.reward_amount_vnd,
      status: "active",
      source_type: "referral_reward",
      source_commission_id: commission.id,
      valid_from: nowIso,
      expires_at: expiresAt,
    })
    .select("id, code")
    .single();

  if (error) {
    // Race: another cron run inserted in the gap → re-fetch.
    const { data: again } = await service
      .from("vouchers")
      .select("id, code")
      .eq("source_commission_id", commission.id)
      .maybeSingle();
    if (again) return again;
    console.error("[referral.voucher.issue] insert failed:", commission.id, error);
    return null;
  }

  return inserted;
}

// ────────────────────────────────────────────────────────────────────────────
// TRANSITION — gọi từ cron rescue-check (sub-task song song affiliate)
// ────────────────────────────────────────────────────────────────────────────

export async function transitionReferralCommissions(
  service: Service,
): Promise<TransitionStats> {
  return transitionCommissionsBase(service, {
    programType: "referral",
    noCheckinTimeoutDays: AFFILIATE_NO_CHECKIN_TIMEOUT_DAYS,
    // Referral KHÔNG suspicious detection (voucher không phải cash).
    onPromoteToPayable: async (svc, row, nowIso) => {
      // Cần beneficiary + reward_amount để tạo voucher.
      const { data: full, error } = await svc
        .from("commissions")
        .select("id, beneficiary_user_id, reward_amount_vnd")
        .eq("id", row.id)
        .maybeSingle();

      if (error || !full) {
        console.error(
          "[referral.transition] commission lookup failed:",
          row.id,
          error,
        );
        return false;
      }

      const voucher = await issueVoucherForCommission(svc, full, nowIso);
      if (!voucher) {
        console.error("[referral.transition] voucher issuance failed:", row.id);
        return false;
      }

      // Voucher OK → promote commission. defaultPromoteToPayable update status.
      const promoted = await defaultPromoteToPayable(svc, row, nowIso);
      if (!promoted) {
        console.error(
          "[referral.transition] promote update failed but voucher exists (idempotent):",
          row.id,
          voucher.id,
        );
      }
      return promoted;
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// VOUCHER EXPIRY — gộp vào rescue-check sub-task.
// ────────────────────────────────────────────────────────────────────────────

export interface VoucherExpiryStats {
  expired: number;
  errors: number;
}

export async function expireOldVouchers(
  service: Service,
): Promise<VoucherExpiryStats> {
  const nowIso = new Date().toISOString();
  const { data, error } = await service
    .from("vouchers")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("expires_at", nowIso)
    .select("id");

  if (error) {
    console.error("[referral.voucher.expire] update failed:", error);
    return { expired: 0, errors: 1 };
  }
  return { expired: data?.length ?? 0, errors: 0 };
}

// Re-export để wiring nơi khác đỡ phải import 2 files.
export { appendHistory };
export type { CommissionRow, StatusHistoryEntry };
