/**
 * Edge Function: midprogram-trigger
 *
 * Chạy mỗi ngày 19:00 ICT (12:00 UTC).
 * Phát hiện enrollments vừa đạt ngày giữa chương trình → nhắc submit mid-program reflection.
 *
 * Deploy:
 *   npx supabase functions deploy midprogram-trigger
 *
 * Cron setup:
 *   select cron.schedule(
 *     'midprogram-trigger',
 *     '0 12 * * *',
 *     $$ select net.http_post(
 *       url     := 'https://<project-ref>.supabase.co/functions/v1/midprogram-trigger',
 *       headers := '{"x-function-secret": "<MIDPROGRAM_TRIGGER_SECRET>"}'::jsonb
 *     ) $$
 *   );
 *
 * Env vars: MIDPROGRAM_TRIGGER_SECRET
 */

import { createAdminClient } from '../_shared/supabase-admin.ts'
import { sendEmail } from '../_shared/email.ts'
import { sendZaloZNS } from '../_shared/zalo.ts'

// ─── Config ──────────────────────────────────────────────────────────────────

const BATCH_SIZE = 50
const FUNCTION_SECRET = Deno.env.get('MIDPROGRAM_TRIGGER_SECRET') ?? ''
const REVIEW_URL = 'https://bodix.fit/app/review/midprogram'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EligibleUser {
  enrollment_id: string
  user_id: string
  current_day: number
  total_days: number
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

  // 1. Active enrollments with program duration
  const { data: enrollments, error } = await supabase
    .from('enrollments')
    .select('id, user_id, cohort_id, current_day, programs(duration_days)')
    .eq('status', 'active')
    .not('cohort_id', 'is', null)
    .range(offset, offset + BATCH_SIZE - 1)

  if (error || !enrollments?.length) return []

  // 2. Filter to cohorts active today
  const cohortIds = [...new Set(enrollments.map((e: { cohort_id: string }) => e.cohort_id))] as string[]
  const { data: activeCohorts } = await supabase
    .from('cohorts')
    .select('id')
    .in('id', cohortIds)
    .eq('status', 'active')
    .lte('start_date', today)
    .gte('end_date', today)

  const activeCohortSet = new Set<string>(activeCohorts?.map((c: { id: string }) => c.id) ?? [])
  const inActiveCohort = enrollments.filter((e: { cohort_id: string }) => activeCohortSet.has(e.cohort_id))
  if (!inActiveCohort.length) return []

  // 3. Keep only enrollments whose current_day == ceil(duration_days / 2)
  const atMidpoint = inActiveCohort.filter((e: {
    current_day: number
    programs: { duration_days: number } | null
  }) => {
    const total = e.programs?.duration_days
    if (!total) return false
    return e.current_day === Math.ceil(total / 2)
  })
  if (!atMidpoint.length) return []

  const enrollmentIds: string[] = atMidpoint.map((e: { id: string }) => e.id)
  const userIds: string[] = atMidpoint.map((e: { user_id: string }) => e.user_id)

  // 4. Exclude enrollments that already have a mid_program_reflection
  const { data: existingReflections } = await supabase
    .from('mid_program_reflections')
    .select('enrollment_id')
    .in('enrollment_id', enrollmentIds)

  const hasReflection = new Set<string>(
    (existingReflections ?? []).map((r: { enrollment_id: string }) => r.enrollment_id)
  )

  // 5. Exclude users already nudged for midprogram (ever — not just today)
  const { data: alreadyNudged } = await supabase
    .from('nudge_logs')
    .select('user_id')
    .in('user_id', userIds)
    .eq('nudge_type', 'morning_reminder') // reuse existing field — see note below
    .eq('content_template', 'midprogram_trigger_v1')

  // NOTE: nudge_logs.nudge_type doesn't have 'midprogram' as a valid value in migration 007.
  // We identify midprogram nudges by content_template = 'midprogram_trigger_v1' instead.
  // Alternative: add 'midprogram_trigger' to the nudge_type CHECK constraint in a new migration.
  const nudgedSet = new Set<string>(
    (alreadyNudged ?? []).map((n: { user_id: string }) => n.user_id)
  )

  // Simpler dedup: check notifications table for type='midprogram_trigger'
  const { data: existingNotifs } = await supabase
    .from('notifications')
    .select('user_id')
    .in('user_id', userIds)
    .eq('type', 'midprogram_trigger')

  const alreadyNotified = new Set<string>(
    (existingNotifs ?? []).map((n: { user_id: string }) => n.user_id)
  )

  const toNotify = atMidpoint.filter((e: { id: string; user_id: string }) =>
    !hasReflection.has(e.id) && !alreadyNotified.has(e.user_id)
  )
  if (!toNotify.length) return []

  // 6. Filter by notification preferences (community_updates = true)
  const toNotifyUserIds: string[] = toNotify.map((e: { user_id: string }) => e.user_id)
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('user_id, preferred_channel, community_updates')
    .in('user_id', toNotifyUserIds)
    .eq('community_updates', true)

  if (!prefs?.length) return []
  const prefMap = new Map<string, string>(
    prefs.map((p: { user_id: string; preferred_channel: string }) => [p.user_id, p.preferred_channel])
  )
  const wantsNotif = toNotify.filter((e: { user_id: string }) => prefMap.has(e.user_id))
  if (!wantsNotif.length) return []

  // 7. Fetch profiles
  const finalUserIds: string[] = wantsNotif.map((e: { user_id: string }) => e.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', finalUserIds)

  const profileMap = new Map<string, { full_name: string | null; phone: string | null }>(
    (profiles ?? []).map((p: { id: string; full_name: string | null; phone: string | null }) => [p.id, p])
  )

  return wantsNotif
    .filter((e: { user_id: string }) => profileMap.has(e.user_id))
    .map((e: {
      id: string; user_id: string; current_day: number
      programs: { duration_days: number } | null
    }): EligibleUser => {
      const profile = profileMap.get(e.user_id)!
      return {
        enrollment_id: e.id,
        user_id: e.user_id,
        current_day: e.current_day,
        total_days: e.programs?.duration_days ?? 21,
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
  const title = 'Đã nửa đường rồi! 🎯'
  const body = `🎯 Nửa chương trình rồi ${firstName}!\nBạn đã đi được ${user.current_day}/${user.total_days} ngày.\nHãy dành 5 phút nhìn lại và đặt mục tiêu cho nửa còn lại.\n👉 Review: ${REVIEW_URL}`

  // ── Send ────────────────────────────────────────────────────────────────
  let delivered = false
  try {
    const ch = user.preferred_channel
    if (ch === 'email' || ch === 'both') {
      await sendEmail(user.user_id, title, body)
    }
    if ((ch === 'zalo' || ch === 'both') && user.phone) {
      await sendZaloZNS(user.phone, 'midprogram_trigger', {
        name: firstName,
        current_day: String(user.current_day),
        total_days: String(user.total_days),
        review_url: REVIEW_URL,
      })
    }
    delivered = true
  } catch (err) {
    console.error(`[midprogram-trigger] send failed for user ${user.user_id}:`, err)
  }

  // ── In-app notification (primary dedup mechanism via type='midprogram_trigger') ─
  const { error: notifError } = await supabase.from('notifications').insert({
    user_id: user.user_id,
    type: 'midprogram_trigger',
    channel: 'in_app',
    title,
    content: body,
    metadata: {
      enrollment_id: user.enrollment_id,
      current_day: user.current_day,
      total_days: user.total_days,
      action_url: '/app/review/midprogram',
    },
  })
  if (notifError) {
    console.error(`[midprogram-trigger] in-app notification failed for user ${user.user_id}:`, notifError)
  }

  // ── nudge_logs — use 'cohort_motivation' as closest valid nudge_type ────────
  // TODO: add 'midprogram_trigger' to nudge_type CHECK constraint in a migration
  const { error: logError } = await supabase.from('nudge_logs').insert({
    user_id: user.user_id,
    enrollment_id: user.enrollment_id,
    nudge_type: 'cohort_motivation',
    channel: user.preferred_channel === 'both' ? 'email' : user.preferred_channel,
    content_template: 'midprogram_trigger_v1',
    content_variables: {
      name: firstName,
      current_day: user.current_day,
      total_days: user.total_days,
      review_url: REVIEW_URL,
    },
    delivered,
  })
  if (logError) {
    console.error(`[midprogram-trigger] nudge_log insert failed for user ${user.user_id}:`, logError)
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
  const today = new Date().toISOString().slice(0, 10)

  let totalSent = 0
  let totalErrors = 0
  let offset = 0
  let batchCount = 0

  try {
    while (true) {
      const users = await fetchEligibleBatch(supabase, offset, today)
      if (!users.length) break

      batchCount++
      console.log(`[midprogram-trigger] batch ${batchCount}: ${users.length} users (offset=${offset})`)

      const results = await Promise.allSettled(
        users.map(user => processUser(supabase, user))
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value === 'sent') totalSent++
          else totalErrors++
        } else {
          console.error('[midprogram-trigger] unhandled error:', result.reason)
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

    console.log('[midprogram-trigger] completed:', JSON.stringify(response))

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[midprogram-trigger] fatal error:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
