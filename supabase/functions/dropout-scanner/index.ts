/**
 * Edge Function: dropout-scanner
 *
 * Chạy mỗi tối 22:00 ICT (15:00 UTC), sau evening-confirmation.
 * Quét toàn bộ enrollments active → tính risk → tạo signals → kích hoạt rescue.
 *
 * Deploy:
 *   npx supabase functions deploy dropout-scanner
 *
 * Cron setup:
 *   select cron.schedule(
 *     'dropout-scanner',
 *     '0 15 * * *',
 *     $$ select net.http_post(
 *       url     := 'https://<project-ref>.supabase.co/functions/v1/dropout-scanner',
 *       headers := '{"x-function-secret": "<DROPOUT_SCANNER_SECRET>"}'::jsonb
 *     ) $$
 *   );
 *
 * Env vars: DROPOUT_SCANNER_SECRET
 */

import { createAdminClient } from '../_shared/supabase-admin.ts'
import { sendEmail } from '../_shared/email.ts'
import { sendZaloZNS } from '../_shared/zalo.ts'

// ─── Config ──────────────────────────────────────────────────────────────────

const BATCH_SIZE = 50
const FUNCTION_SECRET = Deno.env.get('DROPOUT_SCANNER_SECRET') ?? ''
const AUTO_PAUSE_AFTER_DAYS = 7 // pause enrollment after missing this many days

// ─── Templates (inline for Deno runtime) ─────────────────────────────────────

interface Variant { id: string; title: string; body: string }

const RESCUE_SOFT: Variant[] = [
  {
    id: 'rs_1',
    title: 'Mọi thứ ổn chứ?',
    body: '{name} ơi, hôm qua bạn chưa tập. Không sao cả! Hôm nay thử Light mode — chỉ {light_duration} phút nhẹ nhàng nhé 🌿',
  },
  {
    id: 'rs_2',
    title: 'Nghỉ 1 ngày cũng được',
    body: 'Ai cũng có ngày mệt. Quan trọng là quay lại. Hôm nay có bài Recovery {recovery_duration} phút nếu bạn cần nhẹ nhàng.',
  },
]

const RESCUE_URGENT: Variant[] = [
  {
    id: 'ru_1',
    title: 'Đừng dừng lại ở đây',
    body: '{name}, bạn đã đi được {completed_days} ngày rồi. Đừng để streak đứt! Chỉ cần 10 phút Recovery hôm nay — giữ nhịp là đủ. 🙏',
  },
  {
    id: 'ru_2',
    title: 'BodiX nhớ bạn',
    body: '2 ngày rồi chưa gặp bạn. Chúng tôi biết cuộc sống bận rộn. Quay lại với bài 10 phút thôi nhé — mọi thứ vẫn ở đây chờ bạn.',
  },
]

const RESCUE_CRITICAL: Variant[] = [
  {
    id: 'rc_1',
    title: 'Bạn vẫn ở đây',
    body: '{name}, bạn đã hoàn thành {completed_days}/{total_days} ngày. Hành trình vẫn đang chờ. Không cần bắt đầu lại — chỉ cần bước tiếp. Quay lại bất cứ lúc nào. ❤️',
  },
]

function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  return Math.abs(hash >>> 0)
}

function pickVariant(variants: Variant[], userId: string, date: string): Variant {
  return variants[hashString(`${userId}:${date}`) % variants.length]
}

function render(tmpl: string, vars: Record<string, string | number>): string {
  return tmpl.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] !== undefined ? String(vars[k]) : m)
}

function shiftDate(d: string, days: number): string {
  const dt = new Date(d + 'T00:00:00Z')
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrollmentRow {
  id: string
  user_id: string
  cohort_id: string | null
  current_day: number
  program_name: string
  program_duration_days: number
  full_name: string | null
  phone: string | null
  preferred_channel: 'email' | 'zalo' | 'both'
  rescue_messages: boolean
}

interface StreakRow {
  enrollment_id: string
  current_streak: number
  last_checkin_date: string | null
  total_completed_days: number
  total_skip_days: number
}

interface CheckinRow {
  enrollment_id: string
  day_number: number
  mode: string
  feeling: number | null
}

interface SignalInsert {
  enrollment_id: string
  user_id: string
  signal_type: string
  risk_score: number
  signal_date: string
  details: Record<string, unknown>
}

interface RescueInsert {
  enrollment_id: string
  user_id: string
  trigger_reason: string
  risk_score_at_trigger: number
  action_taken: string
  message_sent: string | null
}

interface NudgeToSend {
  user_id: string
  enrollment_id: string
  nudge_type: string
  preferred_channel: 'email' | 'zalo' | 'both'
  phone: string | null
  title: string
  body: string
  variant_id: string
  variables: Record<string, string | number>
}

interface EnrollmentPlan {
  enrollment: EnrollmentRow
  riskScore: number
  daysSinceLast: number
  riskCategory: 'healthy' | 'at_risk' | 'high_risk' | 'critical'
  signals: SignalInsert[]
  rescues: RescueInsert[]
  nudges: NudgeToSend[]
  pause: boolean
}

interface ScanSummary {
  scanned: number
  healthy: number
  at_risk: number
  high_risk: number
  critical: number
  rescues_triggered: number
  paused: number
  effectiveness_updated: number
}

// ─── Risk score (mirrors calculate_risk_score SQL, no RPC needed) ─────────────

function calculateRiskScore(
  enrollment: Pick<EnrollmentRow, 'current_day'>,
  streak: StreakRow,
  recentCheckins: CheckinRow[],
  daysSinceLast: number
): number {
  let score = 0

  // 1. Days missed
  if (daysSinceLast === 1) score += 15
  else if (daysSinceLast === 2) score += 35
  else if (daysSinceLast >= 3) score += 55

  // 2. Feeling trend (last 5 with feeling recorded)
  const feelings = recentCheckins.slice(0, 5).map(c => c.feeling).filter((f): f is number => f !== null)
  if (feelings.length > 0) {
    const avg = feelings.reduce((a, b) => a + b, 0) / feelings.length
    if (avg < 2.5) score += 15
  }

  // 3. Downgrade pattern (last 5 are all light/recovery)
  const last5 = recentCheckins.slice(0, 5)
  if (last5.length >= 3 && last5.every(c => c.mode === 'light' || c.mode === 'recovery')) {
    score += 10
  }

  // 4. Breakdown points D3, D7, D14
  const day = enrollment.current_day
  if (day === 3 || day === 4) score += 10
  else if (day === 7 || day === 8) score += 10
  else if (day === 14 || day === 15) score += 8

  // 5. Excessive skips
  if (streak.total_skip_days > 3) score += 10

  return Math.min(score, 100)
}

function riskCategory(score: number): EnrollmentPlan['riskCategory'] {
  if (score < 20) return 'healthy'
  if (score < 50) return 'at_risk'
  if (score < 80) return 'high_risk'
  return 'critical'
}

// ─── Plan what to do for one enrollment (pure, no DB calls) ──────────────────

function planActions(
  enrollment: EnrollmentRow,
  streak: StreakRow,
  recentCheckins: CheckinRow[],
  today: string,
  existingSignalSet: Set<string>,   // key: `${enrollment_id}:${signal_type}`
  existingRescueSet: Set<string>,   // key: `${enrollment_id}:${trigger_reason}`
  alreadyNudgedSet: Set<string>,    // key: `${enrollment_id}:${nudge_type}`
): EnrollmentPlan {
  const signals: SignalInsert[] = []
  const rescues: RescueInsert[] = []
  const nudges: NudgeToSend[] = []
  let pause = false

  // Days since last check-in
  let daysSinceLast: number
  if (streak.last_checkin_date) {
    const last = new Date(streak.last_checkin_date + 'T00:00:00Z')
    const now = new Date(today + 'T00:00:00Z')
    daysSinceLast = Math.round((now.getTime() - last.getTime()) / 86400000)
  } else {
    daysSinceLast = 0 // No check-in yet — treat as healthy until started
  }

  const riskScore = calculateRiskScore(enrollment, streak, recentCheckins, daysSinceLast)
  const firstName = enrollment.full_name?.trim().split(/\s+/)[0] ?? 'bạn'

  const addSignal = (signal_type: string, details: Record<string, unknown> = {}) => {
    if (existingSignalSet.has(`${enrollment.id}:${signal_type}`)) return
    signals.push({
      enrollment_id: enrollment.id,
      user_id: enrollment.user_id,
      signal_type,
      risk_score: riskScore,
      signal_date: today,
      details,
    })
  }

  const addRescue = (trigger_reason: string, action_taken: string, message_sent: string | null = null) => {
    if (existingRescueSet.has(`${enrollment.id}:${trigger_reason}`)) return
    rescues.push({
      enrollment_id: enrollment.id,
      user_id: enrollment.user_id,
      trigger_reason,
      risk_score_at_trigger: riskScore,
      action_taken,
      message_sent,
    })
  }

  const addNudge = (nudge_type: string, variant: Variant, vars: Record<string, string | number>) => {
    if (!enrollment.rescue_messages) return
    if (alreadyNudgedSet.has(`${enrollment.id}:${nudge_type}`)) return
    nudges.push({
      user_id: enrollment.user_id,
      enrollment_id: enrollment.id,
      nudge_type,
      preferred_channel: enrollment.preferred_channel,
      phone: enrollment.phone,
      title: render(variant.title, vars),
      body: render(variant.body, vars),
      variant_id: variant.id,
      variables: vars,
    })
  }

  const baseVars = {
    name: firstName,
    completed_days: streak.total_completed_days,
    total_days: enrollment.program_duration_days,
    day_number: enrollment.current_day,
    light_duration: 20,
    recovery_duration: 20,
  }

  // ── a. missed_1_day ─────────────────────────────────────────────────────────
  if (daysSinceLast === 1) {
    addSignal('missed_1_day', { days_since_last: 1 })
    // No rescue for 1 missed day — just record
  }

  // ── b. missed_2_days → rescue ───────────────────────────────────────────────
  if (daysSinceLast === 2) {
    addSignal('missed_2_days', { days_since_last: 2, risk_score: riskScore })

    const nudgeType = riskScore >= 60 ? 'rescue_urgent' : 'rescue_soft'
    const variants = riskScore >= 60 ? RESCUE_URGENT : RESCUE_SOFT
    const variant = pickVariant(variants, enrollment.user_id, today)
    const body = render(variant.body, baseVars)

    addRescue('missed_2_days', 'switch_to_light')
    addRescue('missed_2_days', 'send_rescue_message', body)
    addNudge(nudgeType, variant, baseVars)
  }

  // ── c. missed_3_plus_days → rescue_critical ─────────────────────────────────
  if (daysSinceLast >= 3) {
    addSignal('missed_3_plus_days', { days_since_last: daysSinceLast, risk_score: riskScore })

    const variant = pickVariant(RESCUE_CRITICAL, enrollment.user_id, today)
    const body = render(variant.body, baseVars)

    addRescue('missed_3_plus_days', 'send_rescue_message', body)
    addNudge('rescue_critical', variant, baseVars)

    if (daysSinceLast >= AUTO_PAUSE_AFTER_DAYS) {
      pause = true
      addRescue('missed_3_plus_days', 'pause_program')
    }
  }

  // ── d. Breakdown points D3 / D7 / D14 ──────────────────────────────────────
  if (daysSinceLast >= 1) {
    const day = enrollment.current_day
    if (day === 3 || day === 4) addSignal('d3_risk', { current_day: day })
    else if (day === 7 || day === 8) addSignal('d7_risk', { current_day: day })
    else if (day === 14 || day === 15) addSignal('d14_risk', { current_day: day })
  }

  // ── e. Downgrade pattern ────────────────────────────────────────────────────
  const last5 = recentCheckins.slice(0, 5)
  const allSoft = last5.length >= 3 && last5.every(c => c.mode === 'light' || c.mode === 'recovery')
  if (allSoft) {
    addSignal('downgrade_pattern', { modes: last5.map(c => c.mode) })
    // TODO: send cohort_motivation nudge to encourage maintaining intensity
  }

  // ── f. Low feeling trend ────────────────────────────────────────────────────
  const feelings = last5.map(c => c.feeling).filter((f): f is number => f !== null)
  if (feelings.length >= 3) {
    const avg = feelings.reduce((a, b) => a + b, 0) / feelings.length
    if (avg < 2.0) {
      addSignal('low_feeling_trend', { avg_feeling: Math.round(avg * 10) / 10 })
    }
  }

  return {
    enrollment,
    riskScore,
    daysSinceLast,
    riskCategory: riskCategory(riskScore),
    signals,
    rescues,
    nudges,
    pause,
  }
}

// ─── Fetch one batch of active enrollments ───────────────────────────────────

async function fetchEnrollmentBatch(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  offset: number
): Promise<EnrollmentRow[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('id, user_id, cohort_id, current_day, programs(name, duration_days), profiles(full_name, phone)')
    .eq('status', 'active')
    .range(offset, offset + BATCH_SIZE - 1)

  if (error) {
    console.error('[dropout-scanner] fetchEnrollmentBatch:', error)
    return []
  }
  if (!data?.length) return []

  const userIds: string[] = data.map((e: { user_id: string }) => e.user_id)

  // Notification preferences for this batch
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('user_id, preferred_channel, rescue_messages')
    .in('user_id', userIds)

  const prefMap = new Map<string, { preferred_channel: string; rescue_messages: boolean }>(
    (prefs ?? []).map((p: { user_id: string; preferred_channel: string; rescue_messages: boolean }) => [
      p.user_id,
      { preferred_channel: p.preferred_channel, rescue_messages: p.rescue_messages },
    ])
  )

  return data.map((e: {
    id: string; user_id: string; cohort_id: string | null; current_day: number
    programs: { name: string; duration_days: number } | null
    profiles: { full_name: string | null; phone: string | null } | null
  }): EnrollmentRow => {
    const pref = prefMap.get(e.user_id)
    return {
      id: e.id,
      user_id: e.user_id,
      cohort_id: e.cohort_id,
      current_day: e.current_day ?? 1,
      program_name: e.programs?.name ?? 'BodiX',
      program_duration_days: e.programs?.duration_days ?? 21,
      full_name: e.profiles?.full_name ?? null,
      phone: e.profiles?.phone ?? null,
      preferred_channel: (pref?.preferred_channel ?? 'email') as 'email' | 'zalo' | 'both',
      rescue_messages: pref?.rescue_messages ?? true,
    }
  })
}

// ─── Fetch all supporting data for a batch (one round-trip per table) ────────

async function fetchBatchContext(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  enrollments: EnrollmentRow[],
  today: string
) {
  const enrollmentIds = enrollments.map(e => e.id)
  const userIds = enrollments.map(e => e.user_id)

  const [streaksRes, checkinsRes, existingSignalsRes, existingRescuesRes, alreadyNudgedRes] =
    await Promise.all([
      supabase
        .from('streaks')
        .select('enrollment_id, current_streak, last_checkin_date, total_completed_days, total_skip_days')
        .in('enrollment_id', enrollmentIds),

      // Last 5 check-ins per enrollment (batch: 50 × 5 = 250 rows max)
      supabase
        .from('daily_checkins')
        .select('enrollment_id, day_number, mode, feeling')
        .in('enrollment_id', enrollmentIds)
        .order('enrollment_id', { ascending: true })
        .order('day_number', { ascending: false })
        .limit(BATCH_SIZE * 5),

      // Existing signals for today (dedup guard)
      supabase
        .from('dropout_signals')
        .select('enrollment_id, signal_type')
        .in('enrollment_id', enrollmentIds)
        .eq('signal_date', today)
        .eq('resolved', false),

      // Existing pending rescue interventions (dedup guard)
      supabase
        .from('rescue_interventions')
        .select('enrollment_id, trigger_reason')
        .in('enrollment_id', enrollmentIds)
        .eq('outcome', 'pending')
        .gte('created_at', `${today}T00:00:00.000Z`),

      // Rescue nudges already sent today (dedup guard)
      supabase
        .from('nudge_logs')
        .select('enrollment_id, nudge_type')
        .in('enrollment_id', enrollmentIds)
        .in('nudge_type', ['rescue_soft', 'rescue_urgent', 'rescue_critical'])
        .gte('sent_at', `${today}T00:00:00.000Z`),
    ])

  if (streaksRes.error) console.error('[dropout-scanner] streaks:', streaksRes.error)
  if (checkinsRes.error) console.error('[dropout-scanner] checkins:', checkinsRes.error)

  // streak by enrollment_id
  const streakMap = new Map<string, StreakRow>(
    (streaksRes.data ?? []).map((s: StreakRow) => [s.enrollment_id, s])
  )

  // recent check-ins grouped by enrollment_id (already sorted desc)
  const recentCheckinsMap = new Map<string, CheckinRow[]>()
  for (const c of (checkinsRes.data ?? []) as CheckinRow[]) {
    const arr = recentCheckinsMap.get(c.enrollment_id) ?? []
    if (arr.length < 5) {
      arr.push(c)
      recentCheckinsMap.set(c.enrollment_id, arr)
    }
  }

  // existing signals: Set<"enrollment_id:signal_type">
  const existingSignalSet = new Set<string>(
    (existingSignalsRes.data ?? []).map((s: { enrollment_id: string; signal_type: string }) =>
      `${s.enrollment_id}:${s.signal_type}`
    )
  )

  // existing rescues: Set<"enrollment_id:trigger_reason">
  const existingRescueSet = new Set<string>(
    (existingRescuesRes.data ?? []).map((r: { enrollment_id: string; trigger_reason: string }) =>
      `${r.enrollment_id}:${r.trigger_reason}`
    )
  )

  // already nudged today: Set<"enrollment_id:nudge_type">
  const alreadyNudgedSet = new Set<string>(
    (alreadyNudgedRes.data ?? []).map((n: { enrollment_id: string; nudge_type: string }) =>
      `${n.enrollment_id}:${n.nudge_type}`
    )
  )

  return { streakMap, recentCheckinsMap, existingSignalSet, existingRescueSet, alreadyNudgedSet }
}

// ─── Execute batch: write signals, rescues, pause, send nudges ────────────────

async function executeBatch(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  plans: EnrollmentPlan[],
  summary: ScanSummary
): Promise<void> {
  // Collect all inserts
  const allSignals: SignalInsert[] = []
  const allRescues: RescueInsert[] = []
  const enrollmentsToPause: string[] = []

  for (const plan of plans) {
    allSignals.push(...plan.signals)
    allRescues.push(...plan.rescues)
    if (plan.pause) enrollmentsToPause.push(plan.enrollment.id)
    if (plan.rescues.length > 0) summary.rescues_triggered++
    if (plan.pause) summary.paused++
  }

  // Batch insert signals
  if (allSignals.length > 0) {
    const { error } = await supabase.from('dropout_signals').insert(allSignals)
    if (error) console.error('[dropout-scanner] signals insert:', error)
  }

  // Batch insert rescue interventions
  if (allRescues.length > 0) {
    const { error } = await supabase.from('rescue_interventions').insert(allRescues)
    if (error) console.error('[dropout-scanner] rescues insert:', error)
  }

  // Pause enrollments that missed AUTO_PAUSE_AFTER_DAYS+ days
  if (enrollmentsToPause.length > 0) {
    const { error } = await supabase
      .from('enrollments')
      .update({ status: 'paused' })
      .in('id', enrollmentsToPause)
    if (error) console.error('[dropout-scanner] pause enrollments:', error)
    else console.log(`[dropout-scanner] paused ${enrollmentsToPause.length} enrollments`)
  }

  // Send nudges — isolate errors per user
  const nudgesFlat = plans.flatMap(p => p.nudges)
  await Promise.allSettled(nudgesFlat.map(n => sendNudge(supabase, n)))
}

const RESCUE_NUDGE_TYPES = ['rescue_soft', 'rescue_urgent', 'rescue_critical']

async function sendNudge(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  nudge: NudgeToSend
): Promise<void> {
  let delivered = false
  try {
    const ch = nudge.preferred_channel
    if (ch === 'email' || ch === 'both') {
      await sendEmail(nudge.user_id, nudge.title, nudge.body)
    }
    if ((ch === 'zalo' || ch === 'both') && nudge.phone) {
      const zaloParams: Record<string, string> = {}
      for (const [k, v] of Object.entries(nudge.variables)) zaloParams[k] = String(v)
      await sendZaloZNS(nudge.phone, nudge.nudge_type, zaloParams)
    }
    delivered = true
  } catch (err) {
    console.error(`[dropout-scanner] send nudge failed for user ${nudge.user_id}:`, err)
  }

  // In-app notification for rescue messages (always, regardless of channel)
  if (RESCUE_NUDGE_TYPES.includes(nudge.nudge_type)) {
    const dayNumber = nudge.variables.day_number as number | undefined
    const actionUrl = dayNumber != null ? `/app/program/workout/${dayNumber}` : '/app/program'
    const { error: notifErr } = await supabase.from('notifications').insert({
      user_id: nudge.user_id,
      type: nudge.nudge_type,
      channel: 'in_app',
      title: nudge.title,
      content: nudge.body,
      metadata: { action_url: actionUrl, enrollment_id: nudge.enrollment_id },
    })
    if (notifErr) console.error(`[dropout-scanner] in-app notification insert failed for user ${nudge.user_id}:`, notifErr)
  }

  // Log — always, to prevent retry storms
  const { error } = await supabase.from('nudge_logs').insert({
    user_id: nudge.user_id,
    enrollment_id: nudge.enrollment_id,
    nudge_type: nudge.nudge_type,
    channel: nudge.preferred_channel === 'both' ? 'email' : nudge.preferred_channel,
    content_template: nudge.variant_id,
    content_variables: nudge.variables,
    delivered,
  })
  if (error) console.error(`[dropout-scanner] nudge_log insert failed for user ${nudge.user_id}:`, error)
}

// ─── Track nudge effectiveness (update led_to_checkin for yesterday's nudges) ─

async function trackNudgeEffectiveness(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  today: string
): Promise<number> {
  const yesterday = shiftDate(today, -1)

  // Get all unresolved nudge_logs from yesterday (not yet marked as led_to_checkin)
  const { data: logs, error: logsError } = await supabase
    .from('nudge_logs')
    .select('id, enrollment_id')
    .gte('sent_at', `${yesterday}T00:00:00.000Z`)
    .lt('sent_at', `${today}T00:00:00.000Z`)
    .eq('led_to_checkin', false)
    .not('enrollment_id', 'is', null)

  if (logsError) { console.error('[dropout-scanner] effectiveness fetch:', logsError); return 0 }
  if (!logs?.length) return 0

  const enrollmentIds = [...new Set(logs.map((l: { enrollment_id: string }) => l.enrollment_id))]

  // Check which enrollments have a check-in today or from yesterday onward
  const { data: checkins } = await supabase
    .from('daily_checkins')
    .select('enrollment_id')
    .in('enrollment_id', enrollmentIds)
    .gte('completed_at', `${yesterday}T00:00:00.000Z`)

  const checkedInSet = new Set<string>(
    (checkins ?? []).map((c: { enrollment_id: string }) => c.enrollment_id)
  )

  const logIdsToUpdate = (logs as Array<{ id: string; enrollment_id: string }>)
    .filter(l => checkedInSet.has(l.enrollment_id))
    .map(l => l.id)

  if (!logIdsToUpdate.length) return 0

  const { error: updateError } = await supabase
    .from('nudge_logs')
    .update({ led_to_checkin: true })
    .in('id', logIdsToUpdate)

  if (updateError) console.error('[dropout-scanner] effectiveness update:', updateError)

  return logIdsToUpdate.length
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

  const summary: ScanSummary = {
    scanned: 0,
    healthy: 0,
    at_risk: 0,
    high_risk: 0,
    critical: 0,
    rescues_triggered: 0,
    paused: 0,
    effectiveness_updated: 0,
  }

  try {
    // Track yesterday's nudge effectiveness first (background, non-fatal)
    const effectivenessCount = await trackNudgeEffectiveness(supabase, today)
    summary.effectiveness_updated = effectivenessCount
    console.log(`[dropout-scanner] effectiveness updated: ${effectivenessCount} nudges`)

    // Paginate through all active enrollments
    let offset = 0
    let batchCount = 0

    while (true) {
      const enrollments = await fetchEnrollmentBatch(supabase, offset)
      if (!enrollments.length) break

      batchCount++
      console.log(`[dropout-scanner] batch ${batchCount}: ${enrollments.length} enrollments (offset=${offset})`)

      const ctx = await fetchBatchContext(supabase, enrollments, today)

      // Plan all actions in memory (pure, no DB calls)
      const plans: EnrollmentPlan[] = []

      for (const enrollment of enrollments) {
        const streak = ctx.streakMap.get(enrollment.id) ?? {
          enrollment_id: enrollment.id,
          current_streak: 0,
          last_checkin_date: null,
          total_completed_days: 0,
          total_skip_days: 0,
        }
        const recentCheckins = ctx.recentCheckinsMap.get(enrollment.id) ?? []

        try {
          const plan = planActions(
            enrollment,
            streak,
            recentCheckins,
            today,
            ctx.existingSignalSet,
            ctx.existingRescueSet,
            ctx.alreadyNudgedSet,
          )
          plans.push(plan)

          // Accumulate summary stats
          summary.scanned++
          summary[plan.riskCategory]++
        } catch (err) {
          console.error(`[dropout-scanner] planActions failed for enrollment ${enrollment.id}:`, err)
        }
      }

      // Execute all DB writes + sends for this batch
      await executeBatch(supabase, plans, summary)

      if (enrollments.length < BATCH_SIZE) break
      offset += BATCH_SIZE
    }

    const response = {
      success: true,
      processed_at: new Date().toISOString(),
      date: today,
      batches: batchCount,
      summary,
    }

    console.log('[dropout-scanner] completed:', JSON.stringify(response))

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[dropout-scanner] fatal error:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
