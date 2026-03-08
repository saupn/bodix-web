export const TRIAL_DAYS = 3
export const TRIAL_CONTENT_DAY_LIMIT = 3  // user xem được ngày 1, 2, 3

export const VALID_ACTIVITY_TYPES = [
  'view_program',
  'view_workout',
  'try_workout',
  'complete_trial_day',
] as const

export type ActivityType = (typeof VALID_ACTIVITY_TYPES)[number]

export interface ProfileTrialFields {
  trial_ends_at: string | null
}

export interface TrialStatus {
  isTrial: boolean      // trial đang hoạt động (chưa hết hạn)
  isExpired: boolean    // đã có trial nhưng đã hết hạn
  daysRemaining: number
  hoursRemaining: number
}

/**
 * Tính trạng thái trial từ profile.
 * Pure function — không gọi DB.
 */
export function getTrialStatus(profile: ProfileTrialFields): TrialStatus {
  if (!profile.trial_ends_at) {
    return { isTrial: false, isExpired: false, daysRemaining: 0, hoursRemaining: 0 }
  }

  const now = Date.now()
  const end = new Date(profile.trial_ends_at).getTime()
  const diff = end - now

  if (diff <= 0) {
    return { isTrial: false, isExpired: true, daysRemaining: 0, hoursRemaining: 0 }
  }

  return {
    isTrial: true,
    isExpired: false,
    daysRemaining: Math.ceil(diff / (1000 * 60 * 60 * 24)),
    hoursRemaining: Math.ceil(diff / (1000 * 60 * 60)),
  }
}

/**
 * Kiểm tra enrollment có quyền xem nội dung trial không.
 * Truyền trial_ends_at từ profile vào nếu có để kiểm tra thời hạn chính xác.
 */
export function canAccessTrialContent(enrollment: {
  status: string
  trial_ends_at?: string | null
}): boolean {
  if (enrollment.status !== 'trial') return false
  if (!enrollment.trial_ends_at) return true
  return new Date(enrollment.trial_ends_at) > new Date()
}

/**
 * Kiểm tra day_number có nằm trong giới hạn nội dung trial không.
 * Trial chỉ cho xem ngày 1 đến TRIAL_CONTENT_DAY_LIMIT.
 */
export function isWithinTrialContentLimit(dayNumber: number): boolean {
  return dayNumber >= 1 && dayNumber <= TRIAL_CONTENT_DAY_LIMIT
}
