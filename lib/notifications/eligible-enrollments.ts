/**
 * Helper chung cho morning + evening nudge cron.
 *
 * Triết lý: morning và evening PHẢI cùng tập user eligible.
 * Nếu lệch → có user nhận tin sáng nhưng không nhận tin tối (hoặc ngược lại) → bối rối.
 *
 * Eligibility (chung cho cả 2 timing):
 *   - status='active'                              → luôn eligible, bucket='active'
 *   - status ∈ TRIAL_ACCESSIBLE_STATUSES           → eligible CHỈ khi trial_ends_at
 *     ('trial', 'pending_payment',                   còn hạn (theo ngày VN), bucket='trial'
 *      'paid_waiting_cohort')                        — bao gồm cả user đã thanh toán sớm
 *                                                    trong khi trial vẫn còn hiệu lực
 *   - mọi status khác                              → KHÔNG eligible (trial_completed,
 *                                                    completed, dropped, paused, ...)
 *
 * Bucket 'trial' (return.status='trial') là bucket NORMALISED — bất kể status thật
 * là 'trial' / 'pending_payment' / 'paid_waiting_cohort'. Consumer (morning trial loop,
 * evening reminder) chỉ cần xét bucket để build message; không cần biết status gốc.
 *
 * Cột trial cutoff: profiles.trial_ends_at (timestamptz). So sánh sau khi convert
 * sang YYYY-MM-DD VN — tránh edge case timestamp lệch giờ.
 */

import { isoTimestampToVietnamYmd } from "@/lib/date/vietnam";
import { createServiceClient } from "@/lib/supabase/service";
import { TRIAL_ACCESSIBLE_STATUSES } from "@/lib/trial/utils";

export type NudgeTiming = "morning" | "evening";

export interface EligibleProfile {
  id: string;
  full_name: string | null;
  channel_user_id: string | null;
  fcm_token: string | null;
  notification_via: string | null;
  bodix_start_date: string | null;
  trial_ends_at: string | null;
}

export interface EligibleEnrollment {
  enrollment_id: string;
  user_id: string;
  program_id: string;
  cohort_id: string | null;
  cohort_start_date: string | null;
  status: "active" | "trial";
  enrolled_at: string;
  started_at: string | null;
  current_day: number;
  hasApp: boolean; // fcm_token != null
  profile: EligibleProfile;
}

export interface EligibilityBreakdown {
  total: number;
  by_status: { active: number; trial: number };
  by_channel: { fcm: number; zalo: number; none: number };
  trial_expired_filtered: number; // trial bị loại vì trial_ends_at < todayVN
  ineligible_status_filtered: number; // status khác active/trial
}

export interface GetEligibleResult {
  enrollments: EligibleEnrollment[];
  breakdown: EligibilityBreakdown;
}

/**
 * Trả về danh sách enrollment đủ điều kiện nhận nudge.
 *
 * @param timing  'morning' | 'evening' — hiện tại logic eligibility GIỐNG HỆT giữa
 *                2 timing; param chỉ để label log và để cho phép mở rộng sau này
 *                (ví dụ evening có thể thêm filter "đã bắt đầu trong ngày" nếu cần).
 * @param todayVN YYYY-MM-DD theo timezone Asia/Ho_Chi_Minh. Caller dùng
 *                getVietnamDateString() để lấy.
 * @param programId Optional — nếu set, chỉ filter trong program đó.
 */
export async function getEligibleForNudge(
  timing: NudgeTiming,
  todayVN: string,
  programId?: string,
): Promise<GetEligibleResult> {
  const supabase = createServiceClient();

  // Query: lấy mọi enrollment 'active' + trong TRIAL_ACCESSIBLE_STATUSES
  // (trial, pending_payment, paid_waiting_cohort). Lọc trial-expired ở application
  // layer vì so sánh date-only an toàn hơn so với inline SQL.
  const queryStatuses = Array.from(
    new Set<string>(["active", ...Array.from(TRIAL_ACCESSIBLE_STATUSES)]),
  );

  let query = supabase
    .from("enrollments")
    .select(
      `
      id,
      user_id,
      program_id,
      cohort_id,
      status,
      enrolled_at,
      started_at,
      current_day,
      cohorts ( start_date ),
      profiles!inner (
        id,
        full_name,
        channel_user_id,
        fcm_token,
        notification_via,
        bodix_start_date,
        trial_ends_at
      )
    `,
    )
    .in("status", queryStatuses);

  if (programId) {
    query = query.eq("program_id", programId);
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      `[eligible-enrollments] query failed (timing=${timing}):`,
      error,
    );
    return {
      enrollments: [],
      breakdown: {
        total: 0,
        by_status: { active: 0, trial: 0 },
        by_channel: { fcm: 0, zalo: 0, none: 0 },
        trial_expired_filtered: 0,
        ineligible_status_filtered: 0,
      },
    };
  }

  const result: EligibleEnrollment[] = [];
  let trialExpiredFiltered = 0;
  const seenEnrollmentIds = new Set<string>();

  for (const row of data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any;

    // Defensive: profile có thể là array hoặc object tùy version Supabase JS
    const profile: EligibleProfile = Array.isArray(r.profiles)
      ? r.profiles[0]
      : r.profiles;
    const cohort = Array.isArray(r.cohorts) ? r.cohorts[0] : r.cohorts;

    if (!profile?.id) continue;
    if (seenEnrollmentIds.has(r.id as string)) continue;
    seenEnrollmentIds.add(r.id as string);

    const rawStatus = r.status as string;

    // Bucket normalisation: 'active' giữ nguyên; mọi status trong
    // TRIAL_ACCESSIBLE_STATUSES (trial / pending_payment / paid_waiting_cohort)
    // → bucket='trial' miễn là trial_ends_at còn hiệu lực.
    let bucket: "active" | "trial";
    if (rawStatus === "active") {
      bucket = "active";
    } else if (TRIAL_ACCESSIBLE_STATUSES.has(rawStatus)) {
      // Trial bucket: chỉ giữ nếu trial_ends_at >= todayVN (theo ngày VN).
      // NULL trial_ends_at → loại (không thể xác định hạn → an toàn là không gửi).
      if (!profile.trial_ends_at) {
        trialExpiredFiltered++;
        continue;
      }
      const trialEndYmdVN = isoTimestampToVietnamYmd(profile.trial_ends_at);
      if (trialEndYmdVN < todayVN) {
        trialExpiredFiltered++;
        continue;
      }
      bucket = "trial";
    } else {
      // Defensive: query đã filter, nhưng phòng status lạ lọt vào.
      continue;
    }

    result.push({
      enrollment_id: r.id,
      user_id: r.user_id,
      program_id: r.program_id,
      cohort_id: r.cohort_id ?? null,
      cohort_start_date: cohort?.start_date ?? null,
      status: bucket,
      enrolled_at: r.enrolled_at,
      started_at: r.started_at ?? null,
      current_day: r.current_day ?? 1,
      hasApp: !!profile.fcm_token,
      profile,
    });
  }

  // Build breakdown
  const breakdown: EligibilityBreakdown = {
    total: result.length,
    by_status: { active: 0, trial: 0 },
    by_channel: { fcm: 0, zalo: 0, none: 0 },
    trial_expired_filtered: trialExpiredFiltered,
    // Helper chỉ query active/trial; status khác không vào kết quả ngay từ đầu →
    // không đếm được ở đây. Caller có thể tự đếm nếu cần.
    ineligible_status_filtered: 0,
  };

  for (const en of result) {
    breakdown.by_status[en.status]++;
    if (en.hasApp) breakdown.by_channel.fcm++;
    else if (en.profile.channel_user_id) breakdown.by_channel.zalo++;
    else breakdown.by_channel.none++;
  }

  console.log(
    `[eligible-enrollments] timing=${timing} todayVN=${todayVN} program=${programId ?? "all"} ` +
      `→ total=${breakdown.total} active=${breakdown.by_status.active} trial=${breakdown.by_status.trial} ` +
      `fcm=${breakdown.by_channel.fcm} zalo=${breakdown.by_channel.zalo} none=${breakdown.by_channel.none} ` +
      `trial_expired_filtered=${trialExpiredFiltered}`,
  );

  return { enrollments: result, breakdown };
}
