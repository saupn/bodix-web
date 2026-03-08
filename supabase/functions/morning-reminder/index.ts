/**
 * Edge Function: morning-reminder
 *
 * Chạy mỗi sáng 07:00 ICT (00:00 UTC) để gửi nhắc tập cho users đang active.
 *
 * Deploy:
 *   npx supabase functions deploy morning-reminder
 *
 * Cron setup — chọn 1 trong 2:
 *   Option A — Supabase Dashboard > Edge Functions > Schedule:
 *     Cron: "0 0 * * *"
 *
 *   Option B — pg_cron (yêu cầu Pro plan):
 *     select cron.schedule(
 *       'morning-reminder',
 *       '0 0 * * *',
 *       $$ select net.http_post(
 *         url     := 'https://<project-ref>.supabase.co/functions/v1/morning-reminder',
 *         headers := '{"x-function-secret": "<MORNING_REMINDER_SECRET>"}'::jsonb
 *       ) $$
 *     );
 *
 * Env vars (Dashboard > Edge Functions > Secrets):
 *   MORNING_REMINDER_SECRET  — bảo vệ endpoint khỏi invocation trái phép
 */

import { createAdminClient } from '../_shared/supabase-admin.ts'
import { sendEmail } from '../_shared/email.ts'
import { sendZaloZNS } from '../_shared/zalo.ts'

// ─── Config ──────────────────────────────────────────────────────────────────

const BATCH_SIZE = 50
const FUNCTION_SECRET = Deno.env.get('MORNING_REMINDER_SECRET') ?? ''

// ─── Nudge templates (inline — Deno runtime không dùng được @/ aliases) ──────

interface Variant {
  id: string
  title: string
  body: string
}

const MORNING_VARIANTS: Variant[] = [
  {
    id: 'mr_1',
    title: 'Ngày {day_number} đang chờ bạn',
    body: 'Chào {name}! Hôm nay là ngày {day_number}/{total_days} của hành trình {program_name}. Bài tập hôm nay: {workout_title} ({duration} phút). Sẵn sàng chứ? 💪',
  },
  {
    id: 'mr_2',
    title: 'Sáng nay tập gì nhỉ?',
    body: '{name} ơi, hôm nay là {workout_title}. Chỉ {duration} phút thôi. Nếu mệt, chọn Light cũng được nhé! 🌿',
  },
  {
    id: 'mr_3',
    title: '🔥 Streak {current_streak} ngày',
    body: 'Bạn đang giữ chuỗi {current_streak} ngày liên tiếp! Tiếp tục nào — ngày {day_number} đang đợi.',
  },
  {
    id: 'mr_4',
    title: 'Một ngày mới, một bước tiến mới',
    body: "Đã {day_number}/{total_days} rồi đó! Mỗi ngày bạn tập là một ngày bạn gần hơn với phiên bản tốt nhất. Let's go! ✨",
  },
  {
    id: 'mr_5',
    title: '{cohort_today_count} người đã bắt đầu',
    body: 'Trong đợt của bạn, {cohort_today_count} người đã tập sáng nay rồi. Bạn sẵn sàng chứ? 🚀',
  },
]

// djb2-xor hash — phân tán đều cho chuỗi ngắn
function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  }
  return Math.abs(hash >>> 0)
}

function selectVariant(userId: string, date: string, lastVariantId?: string | null): Variant {
  const n = MORNING_VARIANTS.length
  if (n === 1) return MORNING_VARIANTS[0]

  let idx = hashString(`${userId}:${date}`) % n

  // Tránh lặp variant của hôm qua
  if (lastVariantId) {
    const yesterday = new Date(date + 'T00:00:00Z')
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const yDate = yesterday.toISOString().slice(0, 10)
    const yIdx = hashString(`${userId}:${yDate}`) % n
    if (MORNING_VARIANTS[yIdx].id === lastVariantId && idx === yIdx) {
      idx = (idx + 1) % n
    }
  }

  return MORNING_VARIANTS[idx]
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
  cohort_id: string
  current_day: number
  program_id: string
  program_name: string
  program_duration_days: number
  full_name: string | null
  phone: string | null
  preferred_channel: 'email' | 'zalo' | 'both'
}

interface BatchResult {
  sent: number
  skipped: number
  errors: number
}

// ─── Query: fetch eligible users (1 batch) ───────────────────────────────────

async function fetchEligibleBatch(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  offset: number,
  today: string
): Promise<EligibleUser[]> {

  // 1. Active enrollments in active cohorts (paginated)
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('id, user_id, cohort_id, current_day, program_id, programs(name, duration_days)')
    .eq('status', 'active')
    .not('cohort_id', 'is', null)
    .range(offset, offset + BATCH_SIZE - 1)

  if (enrollError || !enrollments?.length) return []

  // 2. Filter to cohorts that are active today
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

  // 3. Filter to users who want morning reminders
  const userIds: string[] = inActiveCohort.map((e: { user_id: string }) => e.user_id)
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('user_id, preferred_channel')
    .in('user_id', userIds)
    .eq('morning_reminder', true)

  if (!prefs?.length) return []
  const prefMap = new Map<string, string>(prefs.map((p: { user_id: string; preferred_channel: string }) => [p.user_id, p.preferred_channel]))
  const wantsReminder = inActiveCohort.filter((e: { user_id: string }) => prefMap.has(e.user_id))
  if (!wantsReminder.length) return []

  // 4. Exclude users already sent a morning_reminder today
  const todayStart = `${today}T00:00:00.000Z`
  const { data: alreadySentLogs } = await supabase
    .from('nudge_logs')
    .select('user_id')
    .in('user_id', wantsReminder.map((e: { user_id: string }) => e.user_id))
    .eq('nudge_type', 'morning_reminder')
    .gte('sent_at', todayStart)

  const alreadySentSet = new Set<string>(alreadySentLogs?.map((l: { user_id: string }) => l.user_id) ?? [])

  // 5. Fetch profiles (full_name, phone)
  const finalUserIds: string[] = wantsReminder
    .filter((e: { user_id: string }) => !alreadySentSet.has(e.user_id))
    .map((e: { user_id: string }) => e.user_id)

  if (!finalUserIds.length) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', finalUserIds)

  const profileMap = new Map<string, { full_name: string | null; phone: string | null }>(
    profiles?.map((p: { id: string; full_name: string | null; phone: string | null }) => [p.id, p]) ?? []
  )

  // 6. Assemble eligible user list
  return wantsReminder
    .filter((e: { user_id: string }) => !alreadySentSet.has(e.user_id) && profileMap.has(e.user_id))
    .map((e: {
      id: string; user_id: string; cohort_id: string; current_day: number; program_id: string;
      programs: { name: string; duration_days: number } | null
    }): EligibleUser => {
      const profile = profileMap.get(e.user_id)!
      return {
        enrollment_id: e.id,
        user_id: e.user_id,
        cohort_id: e.cohort_id,
        current_day: e.current_day ?? 1,
        program_id: e.program_id,
        program_name: e.programs?.name ?? 'BodiX',
        program_duration_days: e.programs?.duration_days ?? 21,
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
  workoutTemplateMap: Map<string, { title: string; duration_minutes: number }>,
  cohortCountMap: Map<string, number>,
  streakMap: Map<string, number>,
  lastVariantMap: Map<string, string | null>
): Promise<'sent' | 'error'> {
  const dayKey = `${user.program_id}:${user.current_day}`
  const workout = workoutTemplateMap.get(dayKey)
  const cohortCount = cohortCountMap.get(user.cohort_id) ?? 0
  const currentStreak = streakMap.get(user.enrollment_id) ?? 0
  const firstName = user.full_name?.trim().split(/\s+/)[0] ?? 'bạn'
  const lastVariantId = lastVariantMap.get(user.user_id) ?? null

  const variant = selectVariant(user.user_id, today, lastVariantId)

  const variables: Record<string, string | number> = {
    name: firstName,
    day_number: user.current_day,
    total_days: user.program_duration_days,
    program_name: user.program_name,
    workout_title: workout?.title ?? 'bài tập hôm nay',
    duration: workout?.duration_minutes ?? 30,
    current_streak: currentStreak,
    cohort_today_count: cohortCount,
  }

  const title = renderTemplate(variant.title, variables)
  const body = renderTemplate(variant.body, variables)

  // ── Send ────────────────────────────────────────────────────────────────────
  let sendSuccess = false
  try {
    const ch = user.preferred_channel
    if (ch === 'email' || ch === 'both') {
      await sendEmail(user.user_id, title, body)
    }
    if ((ch === 'zalo' || ch === 'both') && user.phone) {
      await sendZaloZNS(user.phone, 'morning_reminder', {
        name: firstName,
        day_number: String(user.current_day),
        workout_title: workout?.title ?? '',
        duration: String(workout?.duration_minutes ?? 30),
      })
    }
    sendSuccess = true
  } catch (err) {
    console.error(`[morning-reminder] send failed for user ${user.user_id}:`, err)
  }

  // ── Log to nudge_logs (regardless of send success, to prevent retry storms) ─
  const { error: logError } = await supabase
    .from('nudge_logs')
    .insert({
      user_id: user.user_id,
      enrollment_id: user.enrollment_id,
      nudge_type: 'morning_reminder',
      channel: user.preferred_channel === 'both' ? 'email' : user.preferred_channel,
      content_template: variant.id,
      content_variables: variables,
      delivered: sendSuccess,
    })

  if (logError) {
    console.error(`[morning-reminder] nudge_log insert failed for user ${user.user_id}:`, logError)
  }

  return sendSuccess ? 'sent' : 'error'
}

// ─── Batch context fetcher ────────────────────────────────────────────────────

async function fetchBatchContext(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  users: EligibleUser[],
  today: string
) {
  const enrollmentIds = users.map(u => u.enrollment_id)
  const programIds = [...new Set(users.map(u => u.program_id))]
  const dayNumbers = [...new Set(users.map(u => u.current_day))]
  const cohortIds = [...new Set(users.map(u => u.cohort_id))]
  const userIds = users.map(u => u.user_id)

  const [streaksResult, templatesResult, checkinCountsResult, lastNudgeResult] = await Promise.all([
    // Streaks
    supabase
      .from('streaks')
      .select('enrollment_id, current_streak')
      .in('enrollment_id', enrollmentIds),

    // Workout templates for today's workouts across all programs
    supabase
      .from('workout_templates')
      .select('program_id, day_number, title, duration_minutes')
      .in('program_id', programIds)
      .in('day_number', dayNumbers),

    // Today's check-in counts per cohort (for cohort_today_count variable)
    supabase
      .from('daily_checkins')
      .select('cohort_id')
      .in('cohort_id', cohortIds)
      .eq('workout_date', today),

    // Last variant sent to each user (to avoid repetition)
    supabase
      .from('nudge_logs')
      .select('user_id, content_template')
      .in('user_id', userIds)
      .eq('nudge_type', 'morning_reminder')
      .order('sent_at', { ascending: false }),
  ])

  if (streaksResult.error) console.error('[morning-reminder] streaks fetch:', streaksResult.error)
  if (templatesResult.error) console.error('[morning-reminder] templates fetch:', templatesResult.error)
  if (checkinCountsResult.error) console.error('[morning-reminder] checkin counts fetch:', checkinCountsResult.error)

  // streak by enrollment_id
  const streakMap = new Map<string, number>(
    (streaksResult.data ?? []).map((s: { enrollment_id: string; current_streak: number }) => [s.enrollment_id, s.current_streak])
  )

  // workout template by "program_id:day_number"
  const workoutTemplateMap = new Map<string, { title: string; duration_minutes: number }>(
    (templatesResult.data ?? []).map((t: { program_id: string; day_number: number; title: string; duration_minutes: number }) => [
      `${t.program_id}:${t.day_number}`,
      { title: t.title, duration_minutes: t.duration_minutes },
    ])
  )

  // cohort check-in counts — count rows per cohort_id
  const cohortCountMap = new Map<string, number>()
  for (const row of (checkinCountsResult.data ?? []) as Array<{ cohort_id: string | null }>) {
    if (!row.cohort_id) continue
    cohortCountMap.set(row.cohort_id, (cohortCountMap.get(row.cohort_id) ?? 0) + 1)
  }

  // last variant per user (first row after order-by-desc is the most recent)
  const lastVariantMap = new Map<string, string | null>()
  for (const log of (lastNudgeResult.data ?? []) as Array<{ user_id: string; content_template: string | null }>) {
    if (!lastVariantMap.has(log.user_id)) {
      lastVariantMap.set(log.user_id, log.content_template)
    }
  }

  return { streakMap, workoutTemplateMap, cohortCountMap, lastVariantMap }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Protect endpoint
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
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD UTC

  let totalSent = 0
  let totalSkipped = 0
  let totalErrors = 0
  let offset = 0
  let batchCount = 0

  try {
    // Paginate through all eligible users in batches of BATCH_SIZE
    while (true) {
      const users = await fetchEligibleBatch(supabase, offset, today)

      if (!users.length) break

      batchCount++
      console.log(`[morning-reminder] batch ${batchCount}: ${users.length} users (offset=${offset})`)

      // Fetch supporting data for this batch in parallel
      const ctx = await fetchBatchContext(supabase, users, today)

      // Process each user — errors are isolated per user
      const results = await Promise.allSettled(
        users.map(user =>
          processUser(supabase, user, today, ctx.workoutTemplateMap, ctx.cohortCountMap, ctx.streakMap, ctx.lastVariantMap)
        )
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value === 'sent') totalSent++
          else totalErrors++
        } else {
          console.error('[morning-reminder] unhandled user error:', result.reason)
          totalErrors++
        }
      }

      // If we got fewer than BATCH_SIZE from the initial enrollment query,
      // there are no more pages to fetch
      if (users.length < BATCH_SIZE) break
      offset += BATCH_SIZE
    }

    const response = {
      success: true,
      processed_at: new Date().toISOString(),
      date: today,
      batches: batchCount,
      results: { sent: totalSent, skipped: totalSkipped, errors: totalErrors },
    }

    console.log('[morning-reminder] completed:', JSON.stringify(response))

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[morning-reminder] fatal error:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
