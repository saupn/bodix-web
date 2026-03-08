/**
 * Edge Function: evening-confirmation
 *
 * Chạy mỗi tối 21:00 ICT (14:00 UTC).
 * Chỉ gửi cho users CHƯA check-in hôm nay — tránh làm phiền người đã tập.
 *
 * Deploy:
 *   npx supabase functions deploy evening-confirmation
 *
 * Cron setup — chọn 1 trong 2:
 *   Option A — Supabase Dashboard > Edge Functions > Schedule:
 *     Cron: "0 14 * * *"
 *
 *   Option B — pg_cron (yêu cầu Pro plan):
 *     select cron.schedule(
 *       'evening-confirmation',
 *       '0 14 * * *',
 *       $$ select net.http_post(
 *         url     := 'https://<project-ref>.supabase.co/functions/v1/evening-confirmation',
 *         headers := '{"x-function-secret": "<EVENING_CONFIRMATION_SECRET>"}'::jsonb
 *       ) $$
 *     );
 *
 * Env vars (Dashboard > Edge Functions > Secrets):
 *   EVENING_CONFIRMATION_SECRET
 */

import { createAdminClient } from '../_shared/supabase-admin.ts'
import { sendEmail } from '../_shared/email.ts'
import { sendZaloZNS } from '../_shared/zalo.ts'

// ─── Config ──────────────────────────────────────────────────────────────────

const BATCH_SIZE = 50
const FUNCTION_SECRET = Deno.env.get('EVENING_CONFIRMATION_SECRET') ?? ''

// ─── Templates ────────────────────────────────────────────────────────────────

interface Variant {
  id: string
  title: string
  body: string
}

const EVENING_VARIANTS: Variant[] = [
  {
    id: 'ec_1',
    title: 'Check-in nào!',
    body: '{name} ơi, bạn đã hoàn thành hôm nay chưa? Check-in để giữ streak 🔥 nhé!',
  },
  {
    id: 'ec_2',
    title: 'Đừng quên check-in',
    body: 'Ngày {day_number} sắp kết thúc. Check-in để ghi nhận thành quả hôm nay! Chỉ mất 10 giây thôi.',
  },
  {
    id: 'ec_3',
    title: 'Hôm nay thế nào?',
    body: 'Dù Hard, Light, hay Easy — mỗi ngày bạn check-in đều đáng tự hào. ✅',
  },
]

function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  }
  return Math.abs(hash >>> 0)
}

function selectVariant(userId: string, date: string, lastVariantId?: string | null): Variant {
  const n = EVENING_VARIANTS.length
  if (n === 1) return EVENING_VARIANTS[0]

  let idx = hashString(`${userId}:${date}`) % n

  if (lastVariantId) {
    const yesterday = new Date(date + 'T00:00:00Z')
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const yDate = yesterday.toISOString().slice(0, 10)
    const yIdx = hashString(`${userId}:${yDate}`) % n
    if (EVENING_VARIANTS[yIdx].id === lastVariantId && idx === yIdx) {
      idx = (idx + 1) % n
    }
  }

  return EVENING_VARIANTS[idx]
}

function renderTemplate(tmpl: string, vars: Record<string, string | number>): string {
  return tmpl.replace(/\{(\w+)\}/g, (match, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : match
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EligibleUser {
  enrollment_id: string
  user_id: string
  current_day: number
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

  // 1. Active enrollments in active cohorts (paginated)
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('id, user_id, cohort_id, current_day, programs(duration_days)')
    .eq('status', 'active')
    .not('cohort_id', 'is', null)
    .range(offset, offset + BATCH_SIZE - 1)

  if (enrollError || !enrollments?.length) return []

  // 2. Filter to cohorts active today
  const cohortIds = [...new Set(enrollments.map((e: { cohort_id: string }) => e.cohort_id))]
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

  const userIds: string[] = inActiveCohort.map((e: { user_id: string }) => e.user_id)
  const enrollmentIds: string[] = inActiveCohort.map((e: { id: string }) => e.id)

  // 3. Filter to users who want evening confirmations
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('user_id, preferred_channel')
    .in('user_id', userIds)
    .eq('evening_confirmation', true)

  if (!prefs?.length) return []
  const prefMap = new Map<string, string>(
    prefs.map((p: { user_id: string; preferred_channel: string }) => [p.user_id, p.preferred_channel])
  )
  const wantsConfirmation = inActiveCohort.filter((e: { user_id: string }) => prefMap.has(e.user_id))
  if (!wantsConfirmation.length) return []

  const candidateUserIds: string[] = wantsConfirmation.map((e: { user_id: string }) => e.user_id)
  const candidateEnrollmentIds: string[] = wantsConfirmation.map((e: { id: string }) => e.id)

  // 4. Exclude users who have ALREADY checked in today — core logic of evening nudge
  const { data: todayCheckins } = await supabase
    .from('daily_checkins')
    .select('enrollment_id')
    .in('enrollment_id', candidateEnrollmentIds)
    .eq('workout_date', today)

  const checkedInToday = new Set<string>(
    todayCheckins?.map((c: { enrollment_id: string }) => c.enrollment_id) ?? []
  )

  // 5. Exclude users already sent evening_confirmation today
  const todayStart = `${today}T00:00:00.000Z`
  const { data: alreadySentLogs } = await supabase
    .from('nudge_logs')
    .select('user_id')
    .in('user_id', candidateUserIds)
    .eq('nudge_type', 'evening_confirmation')
    .gte('sent_at', todayStart)

  const alreadySentSet = new Set<string>(
    alreadySentLogs?.map((l: { user_id: string }) => l.user_id) ?? []
  )

  // 6. Build final candidate list (not checked in + not already nudged)
  const finalEnrollments = wantsConfirmation.filter((e: { id: string; user_id: string }) =>
    !checkedInToday.has(e.id) && !alreadySentSet.has(e.user_id)
  )
  if (!finalEnrollments.length) return []

  const finalUserIds: string[] = finalEnrollments.map((e: { user_id: string }) => e.user_id)

  // 7. Fetch profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', finalUserIds)

  const profileMap = new Map<string, { full_name: string | null; phone: string | null }>(
    profiles?.map((p: { id: string; full_name: string | null; phone: string | null }) => [p.id, p]) ?? []
  )

  return finalEnrollments
    .filter((e: { user_id: string }) => profileMap.has(e.user_id))
    .map((e: { id: string; user_id: string; current_day: number }): EligibleUser => {
      const profile = profileMap.get(e.user_id)!
      return {
        enrollment_id: e.id,
        user_id: e.user_id,
        current_day: e.current_day ?? 1,
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
  user: EligibleUser,
  today: string,
  streakMap: Map<string, number>,
  lastVariantMap: Map<string, string | null>
): Promise<'sent' | 'error'> {
  const firstName = user.full_name?.trim().split(/\s+/)[0] ?? 'bạn'
  const currentStreak = streakMap.get(user.enrollment_id) ?? 0
  const lastVariantId = lastVariantMap.get(user.user_id) ?? null

  const variant = selectVariant(user.user_id, today, lastVariantId)

  const variables: Record<string, string | number> = {
    name: firstName,
    day_number: user.current_day,
    current_streak: currentStreak,
  }

  const title = renderTemplate(variant.title, variables)
  const body = renderTemplate(variant.body, variables)

  // ── Send ──────────────────────────────────────────────────────────────────
  let sendSuccess = false
  try {
    const ch = user.preferred_channel
    if (ch === 'email' || ch === 'both') {
      await sendEmail(user.user_id, title, body)
    }
    if ((ch === 'zalo' || ch === 'both') && user.phone) {
      await sendZaloZNS(user.phone, 'evening_confirmation', {
        name: firstName,
        day_number: String(user.current_day),
      })
    }
    sendSuccess = true
  } catch (err) {
    console.error(`[evening-confirmation] send failed for user ${user.user_id}:`, err)
  }

  // ── Log (always, to prevent retry storms on send failure) ─────────────────
  const { error: logError } = await supabase
    .from('nudge_logs')
    .insert({
      user_id: user.user_id,
      enrollment_id: user.enrollment_id,
      nudge_type: 'evening_confirmation',
      channel: user.preferred_channel === 'both' ? 'email' : user.preferred_channel,
      content_template: variant.id,
      content_variables: variables,
      delivered: sendSuccess,
    })

  if (logError) {
    console.error(`[evening-confirmation] nudge_log insert failed for user ${user.user_id}:`, logError)
  }

  return sendSuccess ? 'sent' : 'error'
}

// ─── Batch context fetcher ────────────────────────────────────────────────────

async function fetchBatchContext(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  users: EligibleUser[]
) {
  const enrollmentIds = users.map(u => u.enrollment_id)
  const userIds = users.map(u => u.user_id)

  const [streaksResult, lastNudgeResult] = await Promise.all([
    supabase
      .from('streaks')
      .select('enrollment_id, current_streak')
      .in('enrollment_id', enrollmentIds),

    supabase
      .from('nudge_logs')
      .select('user_id, content_template')
      .in('user_id', userIds)
      .eq('nudge_type', 'evening_confirmation')
      .order('sent_at', { ascending: false }),
  ])

  if (streaksResult.error) console.error('[evening-confirmation] streaks fetch:', streaksResult.error)

  const streakMap = new Map<string, number>(
    (streaksResult.data ?? []).map((s: { enrollment_id: string; current_streak: number }) => [
      s.enrollment_id,
      s.current_streak,
    ])
  )

  // Most-recent variant per user (first row after desc order)
  const lastVariantMap = new Map<string, string | null>()
  for (const log of (lastNudgeResult.data ?? []) as Array<{ user_id: string; content_template: string | null }>) {
    if (!lastVariantMap.has(log.user_id)) {
      lastVariantMap.set(log.user_id, log.content_template)
    }
  }

  return { streakMap, lastVariantMap }
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
      console.log(`[evening-confirmation] batch ${batchCount}: ${users.length} users (offset=${offset})`)

      const ctx = await fetchBatchContext(supabase, users)

      const results = await Promise.allSettled(
        users.map(user => processUser(supabase, user, today, ctx.streakMap, ctx.lastVariantMap))
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value === 'sent') totalSent++
          else totalErrors++
        } else {
          console.error('[evening-confirmation] unhandled user error:', result.reason)
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

    console.log('[evening-confirmation] completed:', JSON.stringify(response))

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[evening-confirmation] fatal error:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
