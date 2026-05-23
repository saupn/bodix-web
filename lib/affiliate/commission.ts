/**
 * Affiliate commission helper — V2 cooldown flow.
 *
 * Status flow:
 *   pending → payable (referee active + ≥1 check-in)
 *   pending → cancelled (timeout / dropped / no_checkin_after_active)
 *   payable → paid (admin payout — out of scope task này)
 *
 * KHÔNG xoá row khi cancel. status_history log mọi transition.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AFFILIATE_COMMISSION_RATE,
  AFFILIATE_PENDING_TIMEOUT_DAYS,
  AFFILIATE_NO_CHECKIN_TIMEOUT_DAYS,
  AFFILIATE_SUSPICIOUS_THRESHOLD,
} from "./config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Service = SupabaseClient<any, any, any>;

type StatusHistoryEntry = {
  at: string;
  from: string | null;
  to: string;
  reason?: string;
};

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
  if (code.code_type !== "affiliate" && !code.is_affiliate) {
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
// ────────────────────────────────────────────────────────────────────────────

interface TransitionStats {
  scanned: number;
  to_payable: number;
  to_cancelled_timeout: number;
  to_cancelled_dropped: number;
  to_cancelled_no_checkin: number;
  flagged_suspicious: number;
  errors: number;
}

export async function transitionAffiliateCommissions(
  service: Service,
): Promise<TransitionStats> {
  const stats: TransitionStats = {
    scanned: 0,
    to_payable: 0,
    to_cancelled_timeout: 0,
    to_cancelled_dropped: 0,
    to_cancelled_no_checkin: 0,
    flagged_suspicious: 0,
    errors: 0,
  };

  const nowIso = new Date().toISOString();

  // Pull pending affiliate commissions cùng enrollment status + started_at
  const { data: rows, error: fetchErr } = await service
    .from("commissions")
    .select(`
      id,
      beneficiary_user_id,
      referee_user_id,
      enrollment_id,
      pending_expires_at,
      status,
      status_history,
      purchase_at,
      enrollments!commissions_enrollment_id_fkey (
        id,
        status,
        started_at
      )
    `)
    .eq("program_type", "affiliate")
    .eq("status", "pending");

  if (fetchErr) {
    console.error("[commission.transition] fetch failed:", fetchErr);
    stats.errors++;
    return stats;
  }

  stats.scanned = rows?.length ?? 0;

  for (const row of rows ?? []) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enrollment = Array.isArray((row as any).enrollments)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (row as any).enrollments[0]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : (row as any).enrollments;
      const enrollmentStatus: string | null = enrollment?.status ?? null;
      const startedAt: string | null = enrollment?.started_at ?? null;

      // ── Check 1: dropped/cancelled trước khi vào active ────────────────────
      if (enrollmentStatus === "dropped") {
        await cancelCommission(service, row, "dropped_before_start");
        stats.to_cancelled_dropped++;
        continue;
      }

      // ── Check 2: active + có check-in → payable ────────────────────────────
      if (enrollmentStatus === "active") {
        const { data: checkin } = await service
          .from("daily_checkins")
          .select("id")
          .eq("enrollment_id", row.enrollment_id)
          .limit(1)
          .maybeSingle();

        if (checkin) {
          await promoteToPayable(service, row);
          stats.to_payable++;
          continue;
        }

        // active mà chưa check-in: check no_checkin timeout
        if (startedAt) {
          const daysSinceActive =
            (new Date(nowIso).getTime() - new Date(startedAt).getTime()) /
            (1000 * 60 * 60 * 24);
          if (daysSinceActive > AFFILIATE_NO_CHECKIN_TIMEOUT_DAYS) {
            await cancelCommission(service, row, "no_checkin_after_active");
            stats.to_cancelled_no_checkin++;
            continue;
          }
        }

        // Vẫn pending — đợi check-in
        continue;
      }

      // ── Check 3: pending timeout, NHƯNG bỏ qua nếu vẫn đang paid_waiting_cohort
      if (enrollmentStatus === "paid_waiting_cohort") {
        continue; // chưa cohort start, không phải lỗi referee → giữ pending
      }

      if (new Date(nowIso) > new Date(row.pending_expires_at)) {
        await cancelCommission(service, row, "timeout");
        stats.to_cancelled_timeout++;
        continue;
      }

      // Còn lại (trial, trial_completed, pending_payment, paused, completed) → giữ pending
    } catch (err) {
      console.error("[commission.transition] row error:", row.id, err);
      stats.errors++;
    }
  }

  // ── Suspicious detection: > N conversion / 7 days theo beneficiary ─────────
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: recentByAffiliate } = await service
    .from("commissions")
    .select("beneficiary_user_id")
    .eq("program_type", "affiliate")
    .gte("created_at", sevenDaysAgo)
    .in("status", ["pending", "payable"]);

  const countByAffiliate = new Map<string, number>();
  for (const r of recentByAffiliate ?? []) {
    countByAffiliate.set(
      r.beneficiary_user_id,
      (countByAffiliate.get(r.beneficiary_user_id) ?? 0) + 1,
    );
  }

  for (const [affiliateId, count] of countByAffiliate.entries()) {
    if (count >= AFFILIATE_SUSPICIOUS_THRESHOLD) {
      const { data: flagged } = await service
        .from("commissions")
        .update({
          status: "suspicious",
          cancelled_at: nowIso,
          cancel_reason: `suspicious_burst:${count}_in_7d`,
        })
        .eq("program_type", "affiliate")
        .eq("beneficiary_user_id", affiliateId)
        .in("status", ["pending", "payable"])
        .gte("created_at", sevenDaysAgo)
        .select("id");
      stats.flagged_suspicious += flagged?.length ?? 0;
    }
  }

  return stats;
}

// ────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────────────────────

async function promoteToPayable(
  service: Service,
  row: { id: string; status: string; status_history: StatusHistoryEntry[] | null },
): Promise<void> {
  const now = new Date().toISOString();
  const history = appendHistory(row.status_history, {
    at: now,
    from: row.status,
    to: "payable",
    reason: "active_and_checked_in",
  });
  await service
    .from("commissions")
    .update({
      status: "payable",
      payable_at: now,
      status_history: history,
    })
    .eq("id", row.id);
}

async function cancelCommission(
  service: Service,
  row: { id: string; status: string; status_history: StatusHistoryEntry[] | null },
  reason: string,
): Promise<void> {
  const now = new Date().toISOString();
  const history = appendHistory(row.status_history, {
    at: now,
    from: row.status,
    to: "cancelled",
    reason,
  });
  await service
    .from("commissions")
    .update({
      status: "cancelled",
      cancelled_at: now,
      cancel_reason: reason,
      status_history: history,
    })
    .eq("id", row.id);
}

function appendHistory(
  current: StatusHistoryEntry[] | null,
  entry: StatusHistoryEntry,
): StatusHistoryEntry[] {
  const arr = Array.isArray(current) ? current : [];
  return [...arr, entry];
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
    .select("id, status, status_history")
    .eq("referee_user_id", refereeUserId)
    .in("status", ["pending", "payable"]);

  let count = 0;
  for (const row of rows ?? []) {
    await cancelCommission(service, row, reason);
    count++;
  }
  return count;
}
