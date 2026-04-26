/**
 * Edge Function: weekly-review-reminder
 *
 * Chạy mỗi Chủ nhật 20:00 ICT (13:00 UTC).
 * Nhắc users submit weekly review cho tuần vừa kết thúc.
 *
 * Deploy:
 *   npx supabase functions deploy weekly-review-reminder
 *
 * Cron setup:
 *   select cron.schedule(
 *     'weekly-review-reminder',
 *     '0 13 * * 0',
 *     $$ select net.http_post(
 *       url     := 'https://<project-ref>.supabase.co/functions/v1/weekly-review-reminder',
 *       headers := '{"x-function-secret": "<WEEKLY_REVIEW_REMINDER_SECRET>"}'::jsonb
 *     ) $$
 *   );
 *
 * Env vars: WEEKLY_REVIEW_REMINDER_SECRET
 */

import { createAdminClient } from '../_shared/supabase-admin.ts'
import { sendEmail } from '../_shared/email.ts'
import { sendZaloZNS } from '../_shared/zalo.ts'

// ─── Config ──────────────────────────────────────────────────────────────────

const BATCH_SIZE = 50
const FUNCTION_SECRET = Deno.env.get('WEEKLY_REVIEW_REMINDER_SECRET') ?? ''
const REVIEW_URL = 'https://bodix.fit/app/review/weekly'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EligibleUser {
  enrollment_id: string
  user_id: string
  week_number: number       // completed week to review
  full_name: string | null
  phone: string | null
  preferred_channel: 'email' | 'zalo' | 'both'
}

// ─── Fetch eligible batch ─────────────────────────────────────────────────────

async function fetchEligibleBatch(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  offset: number,
  today: string
): Promise<EligibleUser[]> {

  // 1. Active enrollments in active cohorts
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('id, user_id, current_day')
    .eq('status', 'active')
    .not('cohort_id', 'is', null)
    .range(offset, offset + BATCH_SIZE - 1)

  if (enrollError || !enrollments?.length) return []

  // 2. Filter to cohorts active today
  const cohortIds: string[] = []
  const enrollmentCohortMap = new Map<string, string>()

  // Re-query with cohort join to get cohort_id
  const enrollmentIds: string[] = enrollments.map((e: { id: string }) => e.id)
  const { data: enrollmentsWithCohort } = await supabase
    .from('enrollments')
    .select('id, cohort_id')
    .in('id', enrollmentIds)
    .not('cohort_id', 'is', null)

  for (const e of enrollmentsWithCohort ?? []) {
    enrollmentCohortMap.set(e.id, e.cohort_id)
    cohortIds.push(e.cohort_id)
  }

  const { data: activeCohorts } = await supabase
    .from('cohorts')
    .select('id')
    .in('id', [...new Set(cohortIds)])
    .eq('status', 'active')
    .lte('start_date', today)
    .gte('end_date', today)

  const activeCohortSet = new Set<string>(activeCohorts?.map((c: { id: string }) => c.id) ?? [])

  const inActiveCohort = enrollments.filter((e: { id: string }) => {
    const cohortId = enrollmentCohortMap.get(e.id)
    return cohortId && activeCohortSet.has(cohortId)
  })
  if (!inActiveCohort.length) return []

  // 3. Compute completed week_number per enrollment
  // completedWeeks = Math.floor(current_day / 7) — same logic as pending route
  const withWeek = inActiveCohort
    .map((e: { id: string; user_id: string; current_day: number }) => ({
      ...e,
      week_number: Math.floor((e.current_day ?? 0) / 7),
    }))
    .filter((e: { week_number: number }) => e.week_number >= 1)

  if (!withWeek.length) return []

  // 4. Filter notification preferences (want week_review notifications)
  const userIds: string[] = withWeek.map((e: { user_id: string }) => e.user_id)
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('user_id, preferred_channel, community_updates')
    .in('user_id', userIds)
    // week_review is part of community_updates channel
    .eq('community_updates', true)

  if (!prefs?.length) return []
  const prefMap = new Map<string, string>(
    prefs.map((p: { user_id: string; preferred_channel: string }) => [p.user_id, p.preferred_channel])
  )
  const wantsReview = withWeek.filter((e: { user_id: string }) => prefMap.has(e.user_id))
  if (!wantsReview.length) return []

  // 5. Exclude users who already submitted this week's review
  const weekReviewPairs = wantsReview.map((e: { id: string; week_number: number }) => ({
    enrollment_id: e.id,
    week_number: e.week_number,
  }))

  // Supabase JS doesn't support multi-column IN; check all candidates and filter in memory
  const { data: existingReviews } = await supabase
    .from('weekly_reviews')
    .select('enrollment_id, week_number')
    .in('enrollment_id', wantsReview.map((e: { id: string }) => e.id))

  const alreadyReviewed = new Set<string>(
    (existingReviews ?? []).map((r: { enrollment_id: string; week_number: number }) =>
      `${r.enrollment_id}:${r.week_number}`
    )
  )

  const needsReview = wantsReview.filter(
    (e: { id: string; week_number: number }) =>
      !alreadyReviewed.has(`${e.id}:${e.week_number}`)
  )
  if (!needsReview.length) return []

  // 6. Exclude users already nudged today for week_review
  const todayStart = `${today}T00:00:00.000Z`
  const { data: alreadyNudged } = await supabase
    .from('nudge_logs')
    .select('user_id')
    .in('user_id', needsReview.map((e: { user_id: string }) => e.user_id))
    .eq('nudge_type', 'week_review')
    .gte('sent_at', todayStart)

  const nudgedSet = new Set<string>(
    (alreadyNudged ?? []).map((n: { user_id: string }) => n.user_id)
  )
  const toNotify = needsReview.filter((e: { user_id: string }) => !nudgedSet.has(e.user_id))
  if (!toNotify.length) return []

  // 7. Fetch profiles (full_name, phone)
  const finalUserIds: string[] = toNotify.map((e: { user_id: string }) => e.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', finalUserIds)

  const profileMap = new Map<string, { full_name: string | null; phone: string | null }>(
    (profiles ?? []).map((p: { id: string; full_name: string | null; phone: string | null }) => [p.id, p])
  )

  return toNotify
    .filter((e: { user_id: string }) => profileMap.has(e.user_id))
    .map((e: { id: string; user_id: string; week_number: number }): EligibleUser => {
      const profile = profileMap.get(e.user_id)!
      return {
        enrollment_id: e.id,
        user_id: e.user_id,
        week_number: e.week_number,
        full_name: profile.full_name,
        phone: profile.phone,
        preferred_channel: (prefMap.get(e.user_id) ?? 'email') as 'email' | 'zalo' | 'both',
      }
    })
}

// ─── Per-user processor ───────────────────────────────────────────────────────

async function processUser(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  user: EligibleUser
): Promise<'sent' | 'error'> {
  const firstName = user.full_name?.trim().split(/\s+/)[0] ?? 'bạn'
  const title = `Tuần ${user.week_number} đã kết thúc! 📝`
  const body = `${firstName} ơi, tuần ${user.week_number} đã kết thúc!\nDành 2 phút review tuần vừa qua nhé.\n👉 Review ngay: ${REVIEW_URL}`

  // ── Send ────────────────────────────────────────────────────────────────
  let delivered = false
  try {
    const ch = user.preferred_channel
    if (ch === 'email' || ch === 'both') {
      await sendEmail(user.user_id, title, body)
    }
    if ((ch === 'zalo' || ch === 'both') && user.phone) {
      await sendZaloZNS(user.phone, 'week_review', {
        name: firstName,
        week_number: String(user.week_number),
        review_url: REVIEW_URL,
      })
    }
    delivered = true
  } catch (err) {
    console.error(`[weekly-review-reminder] send failed for user ${user.user_id}:`, err)
  }

  // ── In-app notification ─────────────────────────────────────────────────
  const { error: notifError } = await supabase.from('notifications').insert({
    user_id: user.user_id,
    type: 'week_review',
    channel: 'in_app',
    title,
    content: body,
    metadata: {
      enrollment_id: user.enrollment_id,
      week_number: user.week_number,
      action_url: '/app/review/weekly',
    },
  })
  if (notifError) {
    console.error(`[weekly-review-reminder] in-app notification failed for user ${user.user_id}:`, notifError)
  }

  // ── Log to nudge_logs (always) ──────────────────────────────────────────
  const { error: logError } = await supabase.from('nudge_logs').insert({
    user_id: user.user_id,
    enrollment_id: user.enrollment_id,
    nudge_type: 'week_review',
    channel: user.preferred_channel === 'both' ? 'email' : user.preferred_channel,
    content_template: 'week_review_v1',
    content_variables: { name: firstName, week_number: user.week_number, review_url: REVIEW_URL },
    delivered,
  })
  if (logError) {
    console.error(`[weekly-review-reminder] nudge_log insert failed for user ${user.user_id}:`, logError)
  }

  return delivered ? 'sent' : 'error'
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (FUNCTION_SECRET) {
    const provided = req.headers.get('x-function-secret')
    if (provided !== FUNCTION_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const supabase = createAdminClient()
  const today = todayUTC()

  let totalSent = 0
  let totalErrors = 0
  let offset = 0
  let batchCount = 0

  try {
    while (true) {
      const users = await fetchEligibleBatch(supabase, offset, today)
      if (!users.length) break

      batchCount++
      console.log(`[weekly-review-reminder] batch ${batchCount}: ${users.length} users (offset=${offset})`)

      const results = await Promise.allSettled(
        users.map(user => processUser(supabase, user))
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value === 'sent') totalSent++
          else totalErrors++
        } else {
          console.error('[weekly-review-reminder] unhandled error:', result.reason)
          totalErrors++
        }
      }

      if (users.length < BATCH_SIZE) break
      offset += BATCH_SIZE
    }

    const response = {
      success: true,
      processed_at: new Date().toISOString(),
      date: today,
      batches: batchCount,
      results: { sent: totalSent, errors: totalErrors },
    }

    console.log('[weekly-review-reminder] completed:', JSON.stringify(response))

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[weekly-review-reminder] fatal error:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
