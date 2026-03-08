/**
 * User status classification for BodiX.
 * Pure functions — no DB calls, no React imports.
 * Used in Server Components and API routes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserStatus =
  | 'new'              // Mới đăng ký, chưa onboarding
  | 'onboarding'       // Đang onboarding (chưa complete)
  | 'no_trial'         // Đã onboarding, chưa chọn trial
  | 'trial_active'     // Đang trong 3 ngày trial
  | 'trial_expired'    // Trial hết hạn, chưa mua
  | 'pending_payment'  // Đã chọn mua, chờ thanh toán
  | 'waiting_cohort'   // Đã mua, chờ cohort bắt đầu
  | 'active_program'   // Đang tập trong cohort
  | 'completed'        // Đã hoàn thành chương trình

export interface StatusProfile {
  onboarding_completed: boolean | null
  trial_ends_at: string | null
}

export interface StatusEnrollment {
  id: string
  status: string
  program_id: string
  cohort_id: string | null
  started_at: string | null
  completed_at: string | null
  program: { slug: string; name: string } | null
  cohort: { status: string; start_date: string } | null
}

export interface UserStatusResult {
  status: UserStatus
  /** Enrollment pù hợp nhất với status hiện tại (để lấy slug, cohort, v.v.) */
  activeEnrollment: StatusEnrollment | null
}

// ---------------------------------------------------------------------------
// getUserStatus
// ---------------------------------------------------------------------------

/**
 * Xác định trạng thái hiện tại của user.
 * Priority từ cao → thấp:
 *   active_program > waiting_cohort > completed > pending_payment >
 *   trial_active/expired > no_trial > onboarding > new
 */
export function getUserStatus(
  profile: StatusProfile | null | undefined,
  enrollments: StatusEnrollment[]
): UserStatusResult {
  // 1. Chưa có profile
  if (!profile) {
    return { status: 'new', activeEnrollment: null }
  }

  // 2. Onboarding chưa xong
  if (!profile.onboarding_completed) {
    return { status: 'onboarding', activeEnrollment: null }
  }

  const now = new Date()

  // 3. Đang tập (status='active')
  const activeEnrollment = enrollments.find((e) => e.status === 'active') ?? null
  if (activeEnrollment) {
    // Cohort đã bắt đầu chưa?
    const cohortStarted =
      activeEnrollment.cohort?.status === 'active' ||
      (activeEnrollment.started_at !== null &&
        new Date(activeEnrollment.started_at) <= now)

    return {
      status: cohortStarted ? 'active_program' : 'waiting_cohort',
      activeEnrollment,
    }
  }

  // 4. Đã hoàn thành (và không có active)
  const completedEnrollment = enrollments.find((e) => e.status === 'completed') ?? null
  if (completedEnrollment) {
    return { status: 'completed', activeEnrollment: completedEnrollment }
  }

  // 5. Chờ thanh toán
  const pendingEnrollment = enrollments.find((e) => e.status === 'pending_payment') ?? null
  if (pendingEnrollment) {
    return { status: 'pending_payment', activeEnrollment: pendingEnrollment }
  }

  // 6. Trial
  const trialEnrollment = enrollments.find((e) => e.status === 'trial') ?? null
  if (trialEnrollment) {
    // Edge Function có thể chưa kịp chuyển status → kiểm tra thời hạn thật
    const trialExpired =
      profile.trial_ends_at !== null && new Date(profile.trial_ends_at) <= now
    return {
      status: trialExpired ? 'trial_expired' : 'trial_active',
      activeEnrollment: trialEnrollment,
    }
  }

  // 7. Đã từng trial nhưng Edge Function đã chuyển sang pending rồi
  //    hoặc trial hết hạn mà không mua → trial_ends_at < now, không còn trial enrollment
  if (profile.trial_ends_at !== null && new Date(profile.trial_ends_at) <= now) {
    return { status: 'trial_expired', activeEnrollment: null }
  }

  // 8. Đã onboarding, chưa chọn chương trình
  return { status: 'no_trial', activeEnrollment: null }
}

// ---------------------------------------------------------------------------
// getRedirectPath
// ---------------------------------------------------------------------------

/**
 * Redirect path tương ứng với từng trạng thái.
 * @param context.slug - slug chương trình (cần cho pending_payment)
 */
export function getRedirectPath(
  status: UserStatus,
  context?: { slug?: string }
): string {
  switch (status) {
    case 'new':
    case 'onboarding':
      return '/onboarding'

    case 'no_trial':
    case 'trial_expired':
      return '/app/programs'

    case 'trial_active':
      return '/app/trial'

    case 'pending_payment':
      return context?.slug ? `/app/checkout/${context.slug}` : '/app/programs'

    case 'waiting_cohort':
    case 'active_program':
    case 'completed':
      return '/app/program'
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Các status cần redirect ra ngoài dashboard. */
export const DASHBOARD_REDIRECT_STATUSES: UserStatus[] = ['new', 'onboarding']

/** Trả về true nếu user có thể vào dashboard bình thường. */
export function canAccessDashboard(status: UserStatus): boolean {
  return !DASHBOARD_REDIRECT_STATUSES.includes(status)
}
