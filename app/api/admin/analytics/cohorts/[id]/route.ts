import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin/verify-admin'
import { createServiceClient } from '@/lib/supabase/service'

// ─── GET — Cohort detail ──────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdmin()
  if ('error' in auth) return auth.error

  const cohortId = params.id
  const service = createServiceClient()

  // ── Verify cohort exists + fetch summary ──────────────────────────────────
  const { data: cohortSummary, error: cohortError } = await service
    .from('mv_cohort_analytics')
    .select('*')
    .eq('cohort_id', cohortId)
    .single()

  if (cohortError || !cohortSummary) {
    return NextResponse.json({ error: 'Cohort không tồn tại.' }, { status: 404 })
  }

  const cohort = cohortSummary as { cohort_id: string; program_slug?: string; program_name?: string; duration_days?: number }
  const { data: cohortRow } = await service.from('cohorts').select('program_id').eq('id', cohortId).single()
  const programId = cohortRow?.program_id ?? null

  // ── Parallel fetches ──────────────────────────────────────────────────────
  const [enrollmentRows, dropoutHotspotsRaw, weeklyFeelingRows] = await Promise.all([
    // Member list: enrollment + profile + streak
    service
      .from('enrollments')
      .select(`
        id, user_id, status, current_day, started_at, amount_paid,
        profiles!enrollments_user_id_fkey (id, full_name, avatar_url),
        streaks (current_streak, longest_streak, last_checkin_date)
      `)
      .eq('cohort_id', cohortId)
      .in('status', ['active', 'completed', 'dropped', 'paused'])
      .order('current_day', { ascending: false }),

    // Dropout hotspots via RPC (requires program_id)
    programId
      ? service.rpc('get_dropout_hotspots', { p_program_id: programId }).then(r => r.data ?? [])
      : Promise.resolve([]),

    // Weekly feeling trend: avg feeling per week across cohort
    service
      .from('weekly_reviews')
      .select('week_number, progress_feeling, fatigue_level, difficulty_rating, week_completion_rate')
      .in(
        'enrollment_id',
        // We need enrollment_ids for this cohort — fetch inline
        service
          .from('enrollments')
          .select('id')
          .eq('cohort_id', cohortId)
          .then(() => null) as unknown as string[]
      )
      .then(() => null),  // placeholder — handled separately below
  ])

  // Weekly feeling: fetch enrollment IDs first, then reviews
  const enrollmentIds = (enrollmentRows.data ?? []).map((e: { id: string }) => e.id)

  const { data: weeklyReviews } = await service
    .from('weekly_reviews')
    .select('week_number, progress_feeling, fatigue_level, difficulty_rating, week_completion_rate')
    .in('enrollment_id', enrollmentIds.length ? enrollmentIds : ['00000000-0000-0000-0000-000000000000'])
    .order('week_number', { ascending: true })

  // ── Daily check-in chart ──────────────────────────────────────────────────
  const { data: checkinsByDay } = await service
    .from('daily_checkins')
    .select('day_number, feeling')
    .in('enrollment_id', enrollmentIds.length ? enrollmentIds : ['00000000-0000-0000-0000-000000000000'])

  const totalEnrolled = enrollmentIds.length
  const checkinDayMap = new Map<number, { count: number; feelingSum: number }>()
  for (const c of checkinsByDay ?? []) {
    const existing = checkinDayMap.get(c.day_number) ?? { count: 0, feelingSum: 0 }
    existing.count++
    existing.feelingSum += c.feeling ?? 0
    checkinDayMap.set(c.day_number, existing)
  }

  const maxDay = (cohortSummary as Record<string, unknown>).duration_days as number ?? 21
  const daily_checkin_chart = Array.from({ length: maxDay }, (_, i) => {
    const day = i + 1
    const entry = checkinDayMap.get(day) ?? { count: 0, feelingSum: 0 }
    return {
      day_number: day,
      checkins: entry.count,
      total_enrolled: totalEnrolled,
      rate: totalEnrolled > 0 ? Math.round(entry.count / totalEnrolled * 1000) / 10 : 0,
      avg_feeling: entry.count > 0 ? Math.round(entry.feelingSum / entry.count * 10) / 10 : null,
    }
  })

  // ── Risk scores per member (parallel) ────────────────────────────────────
  const riskResults = await Promise.allSettled(
    (enrollmentRows.data ?? []).map(async (e: { id: string }) => {
      const { data } = await service.rpc('calculate_risk_score', { p_enrollment_id: e.id })
      return { enrollment_id: e.id, risk_score: (data as number) ?? 0 }
    })
  )
  const riskMap = new Map<string, number>()
  for (const r of riskResults) {
    if (r.status === 'fulfilled') riskMap.set(r.value.enrollment_id, r.value.risk_score)
  }

  // ── Last check-in per enrollment ──────────────────────────────────────────
  const { data: lastCheckins } = await service
    .from('daily_checkins')
    .select('enrollment_id, workout_date')
    .in('enrollment_id', enrollmentIds.length ? enrollmentIds : ['00000000-0000-0000-0000-000000000000'])
    .order('workout_date', { ascending: false })

  const lastCheckinMap = new Map<string, string>()
  for (const c of lastCheckins ?? []) {
    if (!lastCheckinMap.has(c.enrollment_id)) lastCheckinMap.set(c.enrollment_id, c.workout_date)
  }

  // ── Member list ───────────────────────────────────────────────────────────
  type ProfileShape = { id: string; full_name: string | null; avatar_url: string | null }
  type StreakShape  = { current_streak: number; longest_streak: number; last_checkin_date: string | null } | null

  const member_list = (enrollmentRows.data ?? []).map((e: {
    id: string; user_id: string; status: string; current_day: number
    started_at: string | null; amount_paid: number
    profiles: ProfileShape | null; streaks: StreakShape
  }) => {
    const profile = e.profiles
    const streak  = Array.isArray(e.streaks) ? e.streaks[0] : e.streaks
    const riskScore = riskMap.get(e.id) ?? 0
    const riskLevel = riskScore >= 70 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 30 ? 'medium' : 'low'
    const completionRate = maxDay > 0
      ? Math.round((e.current_day ?? 0) / maxDay * 1000) / 10
      : 0

    return {
      enrollment_id: e.id,
      user_id: e.user_id,
      full_name: profile?.full_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      status: e.status,
      current_day: e.current_day ?? 0,
      completion_rate: completionRate,
      current_streak: streak?.current_streak ?? 0,
      longest_streak: streak?.longest_streak ?? 0,
      last_checkin: lastCheckinMap.get(e.id) ?? null,
      risk_score: riskScore,
      risk_level: riskLevel,
    }
  })

  // ── Weekly feeling trend ──────────────────────────────────────────────────
  const weekMap = new Map<number, { feeling: number[]; fatigue: number[]; difficulty: number[]; completion: number[] }>()
  for (const r of weeklyReviews ?? []) {
    const entry = weekMap.get(r.week_number) ?? { feeling: [], fatigue: [], difficulty: [], completion: [] }
    if (r.progress_feeling != null)    entry.feeling.push(r.progress_feeling)
    if (r.fatigue_level != null)       entry.fatigue.push(r.fatigue_level)
    if (r.difficulty_rating != null)   entry.difficulty.push(r.difficulty_rating)
    if (r.week_completion_rate != null) entry.completion.push(Number(r.week_completion_rate))
    weekMap.set(r.week_number, entry)
  }

  const avgArr = (arr: number[]) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 10) / 10 : null

  const weekly_feeling_trend = Array.from(weekMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([week, data]) => ({
      week_number: week,
      avg_feeling: avgArr(data.feeling),
      avg_fatigue: avgArr(data.fatigue),
      avg_difficulty: avgArr(data.difficulty),
      avg_completion: avgArr(data.completion),
      respondents: data.feeling.length,
    }))

  return NextResponse.json({
    summary: cohortSummary,
    daily_checkin_chart,
    dropout_hotspots: dropoutHotspotsRaw,
    member_list,
    weekly_feeling_trend,
  }, {
    headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=60' },
  })
}
