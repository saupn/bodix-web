/**
 * lib/validation/schemas.ts
 *
 * Zod schemas for all API inputs.
 * Import the schema you need + safeParseBody() into any route handler.
 *
 * Usage:
 *   const result = safeParseBody(checkinSchema, await request.json())
 *   if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
 *   const { enrollment_id, mode, ... } = result.data
 */

import { z } from 'zod'

// ─── Sanitizer ────────────────────────────────────────────────────────────────

/**
 * Strip HTML tags from user-supplied text to prevent stored XSS.
 * Also collapses internal whitespace and trims.
 */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')          // remove tags
    .replace(/&[a-z]+;/gi, ' ')       // remove HTML entities
    .replace(/\s+/g, ' ')             // collapse whitespace
    .trim()
}

/** String field: strip HTML, enforce max length. */
function sanitized(maxLength: number) {
  return z.string().max(maxLength).transform(stripHtml)
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const checkinSchema = z.object({
  enrollment_id:    z.string().uuid('enrollment_id phải là UUID hợp lệ.'),
  day_number:       z.number().int().min(1).max(84),
  mode:             z.enum(['hard', 'light', 'recovery', 'skip']),
  feeling:          z.number().int().min(1).max(5).optional(),
  feeling_note:     sanitized(500).optional(),
  duration_minutes: z.number().int().min(1).max(300).optional(),
})
export type CheckinInput = z.infer<typeof checkinSchema>

export const weeklyReviewSchema = z.object({
  enrollment_id:     z.string().uuid(),
  week_number:       z.number().int().min(1).max(12),
  fatigue_level:     z.number().int().min(1).max(5),
  progress_feeling:  z.number().int().min(1).max(5),
  difficulty_rating: z.number().int().min(1).max(5),
  body_changes:      sanitized(1000).optional(),
  biggest_challenge: sanitized(1000).optional(),
  next_week_goal:    sanitized(1000).optional(),
})
export type WeeklyReviewInput = z.infer<typeof weeklyReviewSchema>

export const midProgramReflectionSchema = z.object({
  enrollment_id:           z.string().uuid(),
  overall_progress:        z.number().int().min(1).max(10),
  visible_changes:         z.array(sanitized(100)).max(10).optional(),
  original_goal:           sanitized(500).optional(),
  goal_still_relevant:     z.boolean().optional(),
  updated_goal:            sanitized(500).optional(),
  wants_intensity_change:  z.enum(['more_hard', 'keep_same', 'more_light']).optional(),
  what_works_well:         sanitized(1000).optional(),
  what_to_improve:         sanitized(1000).optional(),
  would_recommend:         z.boolean().optional(),
  recommendation_score:    z.number().int().min(0).max(10).optional(),
})
export type MidProgramReflectionInput = z.infer<typeof midProgramReflectionSchema>

export const referralCodeSchema = z.object({
  code: z
    .string()
    .min(3, 'Code tối thiểu 3 ký tự.')
    .max(20, 'Code tối đa 20 ký tự.')
    // Only uppercase letters, digits, underscores, hyphens; must start and end with alnum
    .regex(/^[A-Z0-9][A-Z0-9_-]{1,18}[A-Z0-9]$|^[A-Z0-9]{3}$/, 'Code chứa ký tự không hợp lệ.')
    .transform(s => s.toUpperCase()),
})
export type ReferralCodeInput = z.infer<typeof referralCodeSchema>

export const communityPostSchema = z.object({
  cohort_id: z.string().uuid().optional(),
  post_type: z.enum([
    'completion_share',
    'milestone_share',
    'progress_photo',
    'motivation',
    'question',
    'program_complete',
  ]),
  content:        sanitized(2000).optional(),
  milestone_type: z.string().max(50).optional(),
})
export type CommunityPostInput = z.infer<typeof communityPostSchema>

export const notificationPrefsSchema = z.object({
  morning_reminder:     z.boolean(),
  evening_confirmation: z.boolean(),
  rescue_messages:      z.boolean(),
  community_updates:    z.boolean(),
  marketing_emails:     z.boolean(),
  preferred_channel:    z.enum(['email', 'zalo', 'both']),
  morning_time:         z.string().regex(/^\d{2}:\d{2}$/).optional(),
  evening_time:         z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timezone:             z.string().max(50).optional(),
})
export type NotificationPrefsInput = z.infer<typeof notificationPrefsSchema>

export const checkoutCreateSchema = z.object({
  program_slug:    z.enum(['bodix-21', 'bodix-6w', 'bodix-12w']),
  referral_code:   z.string().max(20).optional(),
  payment_method:  z.enum(['bank_transfer', 'momo', 'vnpay']),
})
export type CheckoutCreateInput = z.infer<typeof checkoutCreateSchema>

// ─── Parse helpers ────────────────────────────────────────────────────────────

/**
 * Parse and validate a request body against a schema.
 * Returns { ok: true, data } on success.
 * Returns { ok: false, error } with a user-friendly message on failure.
 */
export function safeParseBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(data)
  if (result.success) return { ok: true, data: result.data }

  const first = result.error.errors[0]
  const field = first.path.join('.')
  const msg = field ? `${field}: ${first.message}` : first.message
  return { ok: false, error: msg }
}
