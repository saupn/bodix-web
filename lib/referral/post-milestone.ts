/**
 * lib/referral/post-milestone.ts
 *
 * Referral prompts triggered after milestone celebrations.
 *
 * Usage — CelebrationOverlay (Phase 3):
 *   const prompt = getReferralPrompt(milestoneType)
 *   if (prompt?.show) {
 *     // after main celebration animation ends, render <ReferralPromptCard>
 *     // timing === 'after_celebration' → show immediately after confetti
 *     // timing === 'after_reflection'  → show after mid-program reflection submit
 *     // timing === 'celebration_page'  → full-page section on /app/complete
 *   }
 *
 * Usage — Weekly review success:
 *   const prompt = getReferralPrompt('week_complete')
 *   // Render subtle inline suggestion below the success message
 *
 * Usage — Program complete page (/app/complete):
 *   const prompt = getReferralPrompt('program_complete')
 *   const shareMsg = buildShareMessage({ program_name, total_days, total_hard, code })
 *   // Render full ShareSection with Zalo / Facebook / copy-link buttons
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReferralPromptTiming =
  | 'after_celebration'   // show immediately after milestone confetti fades
  | 'after_reflection'    // show after mid-program reflection is submitted
  | 'celebration_page'    // occupies a dedicated section on the completion page

export interface ReferralPrompt {
  show: true
  message: string
  timing: ReferralPromptTiming
  /** CTA button label */
  cta: string
  /** Route to navigate when CTA is tapped */
  cta_href: string
  /** Whether the user can dismiss without acting */
  dismissible: boolean
}

// ─── Core mapping ─────────────────────────────────────────────────────────────

const PROMPTS: Partial<Record<string, ReferralPrompt>> = {
  streak_7: {
    show: true,
    message: '7 ngày liên tiếp! Giới thiệu bạn bè cùng tập – bạn nhận 50k credit!',
    timing: 'after_celebration',
    cta: 'Chia sẻ ngay',
    cta_href: '/app/referral',
    dismissible: true,
  },

  week_complete: {
    show: true,
    message: 'Tuần hoàn hảo! Có ai bạn muốn rủ tập cùng không?',
    timing: 'after_celebration',
    cta: 'Mã giới thiệu',
    cta_href: '/app/referral',
    dismissible: true,
  },

  halfway: {
    show: true,
    message: 'Nửa đường rồi! Chia sẻ hành trình – mã giới thiệu trong túi.',
    timing: 'after_reflection',
    cta: 'Xem mã của tôi',
    cta_href: '/app/referral',
    dismissible: true,
  },

  program_complete: {
    show: true,
    message: 'HOÀN THÀNH! Bạn chính là minh chứng. Giới thiệu BodiX cho bạn bè!',
    timing: 'celebration_page',
    cta: 'Chia sẻ thành tích',
    cta_href: '/app/referral',
    dismissible: false,   // completion page always shows this section
  },
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Returns the referral prompt config for a given milestone, or null if the
 * milestone should not trigger a referral nudge.
 *
 * @example
 *   const prompt = getReferralPrompt('streak_7')
 *   // { show: true, message: '...', timing: 'after_celebration', ... }
 *
 *   const nothing = getReferralPrompt('first_checkin')
 *   // null
 */
export function getReferralPrompt(milestoneType: string): ReferralPrompt | null {
  return PROMPTS[milestoneType] ?? null
}

// ─── Share message builder ────────────────────────────────────────────────────

export interface ShareMessageOptions {
  program_name: string     // "BodiX 21" | "BodiX 6W" | "BodiX 12W"
  total_days: number       // total program duration days completed
  total_hard: number       // number of Hard sessions completed
  code: string             // referral code, e.g. "BODIX-A7K3"
}

/**
 * Builds the pre-filled share text for the program_complete referral section.
 * Used by Zalo / Facebook / copy-link share buttons.
 */
export function buildShareMessage(opts: ShareMessageOptions): string {
  const { program_name, total_days, total_hard, code } = opts
  return (
    `Mình vừa hoàn thành ${program_name}! ${total_days} ngày, ${total_hard} buổi Hard.\n` +
    `Nếu bạn cũng muốn thay đổi, thử BodiX: bodix.fit?ref=${code}\n` +
    `Giảm 10% cho bạn! 💪`
  )
}

// ─── Share platform configs ───────────────────────────────────────────────────

export interface SharePlatform {
  id: 'zalo' | 'facebook' | 'link'
  label: string
  /** Build the platform share URL from the pre-filled message + referral link */
  buildUrl: (message: string, referralLink: string) => string
}

export const SHARE_PLATFORMS: SharePlatform[] = [
  {
    id: 'zalo',
    label: 'Chia sẻ Zalo',
    buildUrl: (_message, referralLink) =>
      `https://zalo.me/share?url=${encodeURIComponent(referralLink)}&title=${encodeURIComponent(
        "Tập cùng mình trên BodiX – giảm 10% khi đăng ký!"
      )}`,
  },
  {
    id: 'facebook',
    label: 'Chia sẻ Facebook',
    buildUrl: (_message, referralLink) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`,
  },
  {
    id: 'link',
    label: 'Sao chép link',
    buildUrl: (_message, referralLink) => referralLink,
  },
]

// ─── Completion page copy ─────────────────────────────────────────────────────

/**
 * Static copy for the program_complete referral section on /app/complete.
 * Kept here so the frontend just imports — no magic strings in components.
 */
export const COMPLETION_REFERRAL_COPY = {
  headline: 'Bạn đã làm được điều mà 90% người tập không làm được: HOÀN THÀNH.',
  subheadline: 'Giờ hãy truyền cảm hứng cho bạn bè của bạn.',
  reward_referrer: 'Bạn nhận: +50k credit mỗi người đăng ký qua link',
  reward_referee: 'Bạn bè nhận: Giảm 10% chương trình đầu tiên',
  cta_primary: 'Chia sẻ ngay',
  cta_secondary: 'Sao chép link',
} as const
