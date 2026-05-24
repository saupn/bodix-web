/**
 * Shared transition shell cho commissions (affiliate + referral).
 *
 * Logic CHUNG (đúng với BD-AFFILIATE-COOLDOWN-V2 đã verify):
 *  - pending + enrollment.status='dropped' → cancel 'dropped_before_start'
 *  - pending + enrollment.status='active' + có ≥1 daily_checkin → onPromoteToPayable
 *  - pending + enrollment.status='active' + chưa check-in + > N ngày → cancel 'no_checkin_after_active'
 *  - pending + enrollment.status='paid_waiting_cohort' → giữ pending (cohort chưa start)
 *  - pending + now > pending_expires_at + status khác → cancel 'timeout'
 *  - Optional suspicious detection: count by beneficiary trong 7 ngày
 *
 * Custom kernel:
 *  - `onPromoteToPayable`: chạy khi đủ điều kiện promote. Affiliate update
 *    status='payable' đơn giản; Referral tạo voucher (idempotent) rồi update.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Service = SupabaseClient<any, any, any>;

export type StatusHistoryEntry = {
  at: string;
  from: string | null;
  to: string;
  reason?: string;
};

export interface CommissionRow {
  id: string;
  status: string;
  status_history: StatusHistoryEntry[] | null;
  pending_expires_at: string;
  beneficiary_user_id: string;
  referee_user_id: string;
  enrollment_id: string | null;
  purchase_at: string;
}

export interface CommissionWithEnrollment extends CommissionRow {
  enrollments?:
    | { id: string; status: string | null; started_at: string | null }
    | { id: string; status: string | null; started_at: string | null }[]
    | null;
}

export interface TransitionStats {
  scanned: number;
  to_payable: number;
  to_cancelled_timeout: number;
  to_cancelled_dropped: number;
  to_cancelled_no_checkin: number;
  flagged_suspicious: number;
  errors: number;
}

export interface TransitionOptions {
  programType: "affiliate" | "referral";
  noCheckinTimeoutDays: number;
  /** Optional suspicious-burst detection. Nếu không truyền → skip. */
  suspicious?: {
    thresholdCount: number;
    windowDays: number;
  };
  /**
   * Custom kernel khi promote pending → payable. Mặc định: update status='payable'.
   * Referral override để tạo voucher trước.
   * Trả về true nếu promote OK; false nếu skip/error (row giữ pending).
   */
  onPromoteToPayable?: (
    service: Service,
    row: CommissionRow,
    nowIso: string,
  ) => Promise<boolean>;
}

// ────────────────────────────────────────────────────────────────────────────
// Public helpers
// ────────────────────────────────────────────────────────────────────────────

export function appendHistory(
  current: StatusHistoryEntry[] | null,
  entry: StatusHistoryEntry,
): StatusHistoryEntry[] {
  const arr = Array.isArray(current) ? current : [];
  return [...arr, entry];
}

export async function defaultPromoteToPayable(
  service: Service,
  row: CommissionRow,
  nowIso: string,
): Promise<boolean> {
  const history = appendHistory(row.status_history, {
    at: nowIso,
    from: row.status,
    to: "payable",
    reason: "active_and_checked_in",
  });
  const { error } = await service
    .from("commissions")
    .update({
      status: "payable",
      payable_at: nowIso,
      status_history: history,
    })
    .eq("id", row.id);
  if (error) {
    console.error("[commissions.base] promoteToPayable update failed:", row.id, error);
    return false;
  }
  return true;
}

export async function cancelCommission(
  service: Service,
  row: CommissionRow,
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

// ────────────────────────────────────────────────────────────────────────────
// Main transition
// ────────────────────────────────────────────────────────────────────────────

export async function transitionCommissionsBase(
  service: Service,
  options: TransitionOptions,
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
  const onPromote = options.onPromoteToPayable ?? defaultPromoteToPayable;

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
    .eq("program_type", options.programType)
    .eq("status", "pending");

  if (fetchErr) {
    console.error(
      `[commissions.base] ${options.programType} fetch failed:`,
      fetchErr,
    );
    stats.errors++;
    return stats;
  }

  stats.scanned = rows?.length ?? 0;

  for (const raw of (rows ?? []) as CommissionWithEnrollment[]) {
    try {
      const enrollment = Array.isArray(raw.enrollments)
        ? raw.enrollments[0]
        : raw.enrollments;
      const enrollmentStatus: string | null = enrollment?.status ?? null;
      const startedAt: string | null = enrollment?.started_at ?? null;

      const row: CommissionRow = {
        id: raw.id,
        status: raw.status,
        status_history: raw.status_history,
        pending_expires_at: raw.pending_expires_at,
        beneficiary_user_id: raw.beneficiary_user_id,
        referee_user_id: raw.referee_user_id,
        enrollment_id: raw.enrollment_id,
        purchase_at: raw.purchase_at,
      };

      // Check 1: dropped/cancelled trước khi vào active
      if (enrollmentStatus === "dropped") {
        await cancelCommission(service, row, "dropped_before_start");
        stats.to_cancelled_dropped++;
        continue;
      }

      // Check 2: active + ≥1 check-in → onPromoteToPayable
      if (enrollmentStatus === "active" && row.enrollment_id) {
        const { data: checkin } = await service
          .from("daily_checkins")
          .select("id")
          .eq("enrollment_id", row.enrollment_id)
          .limit(1)
          .maybeSingle();

        if (checkin) {
          const ok = await onPromote(service, row, nowIso);
          if (ok) stats.to_payable++;
          else stats.errors++;
          continue;
        }

        // active mà chưa check-in: check no_checkin timeout
        if (startedAt) {
          const daysSinceActive =
            (new Date(nowIso).getTime() - new Date(startedAt).getTime()) /
            (1000 * 60 * 60 * 24);
          if (daysSinceActive > options.noCheckinTimeoutDays) {
            await cancelCommission(service, row, "no_checkin_after_active");
            stats.to_cancelled_no_checkin++;
            continue;
          }
        }

        // Vẫn pending — đợi check-in
        continue;
      }

      // Check 3: paid_waiting_cohort → giữ pending
      if (enrollmentStatus === "paid_waiting_cohort") {
        continue;
      }

      // Check 4: timeout
      if (new Date(nowIso) > new Date(row.pending_expires_at)) {
        await cancelCommission(service, row, "timeout");
        stats.to_cancelled_timeout++;
        continue;
      }

      // Còn lại (trial, trial_completed, pending_payment, paused, completed) → giữ pending
    } catch (err) {
      console.error(
        `[commissions.base] ${options.programType} row error:`,
        raw.id,
        err,
      );
      stats.errors++;
    }
  }

  // Optional suspicious-burst detection.
  if (options.suspicious) {
    const { thresholdCount, windowDays } = options.suspicious;
    const windowStart = new Date(
      Date.now() - windowDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: recent } = await service
      .from("commissions")
      .select("beneficiary_user_id")
      .eq("program_type", options.programType)
      .gte("created_at", windowStart)
      .in("status", ["pending", "payable"]);

    const countByBeneficiary = new Map<string, number>();
    for (const r of recent ?? []) {
      countByBeneficiary.set(
        r.beneficiary_user_id,
        (countByBeneficiary.get(r.beneficiary_user_id) ?? 0) + 1,
      );
    }

    for (const [beneficiaryId, count] of countByBeneficiary.entries()) {
      if (count >= thresholdCount) {
        const { data: flagged } = await service
          .from("commissions")
          .update({
            status: "suspicious",
            cancelled_at: nowIso,
            cancel_reason: `suspicious_burst:${count}_in_${windowDays}d`,
          })
          .eq("program_type", options.programType)
          .eq("beneficiary_user_id", beneficiaryId)
          .in("status", ["pending", "payable"])
          .gte("created_at", windowStart)
          .select("id");
        stats.flagged_suspicious += flagged?.length ?? 0;
      }
    }
  }

  return stats;
}
