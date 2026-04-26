import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidateAnalytics } from '@/lib/cache'
import { checkinRateLimit, rateLimitExceeded } from '@/lib/middleware/rate-limit'
import { checkinSchema, safeParseBody } from '@/lib/validation/schemas'

/** Add/subtract days from an ISO date string (YYYY-MM-DD), UTC-safe. */
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Today's date as YYYY-MM-DD (UTC). */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function POST(request: NextRequest) {
  // ─── 1. Auth ────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  // ─── 1b. Rate limit — per user ───────────────────────────────────────────────
  const rl = checkinRateLimit(user.id)
  if (!rl.ok) return rateLimitExceeded(rl.resetIn)

  // ─── Parse & validate body ───────────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = safeParseBody(checkinSchema, rawBody)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { enrollment_id, day_number, mode, feeling, feeling_note, duration_minutes } = parsed.data

  const service = createServiceClient()

  // ─── 2. Verify enrollment ────────────────────────────────────────────────────
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('id, user_id, cohort_id, status, started_at, current_day, program_id, programs(duration_days)')
    .eq('id', enrollment_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (enrollmentError || !enrollment) {
    return NextResponse.json({ error: 'Enrollment không tồn tại hoặc chưa active.' }, { status: 404 })
  }

  if (!enrollment.started_at) {
    return NextResponse.json({ error: 'Chương trình chưa bắt đầu.' }, { status: 400 })
  }

  // programs is a joined object; Supabase returns it as { duration_days: number }
  const programDays = (enrollment.programs as unknown as { duration_days: number }).duration_days

  // ─── 3 & 4. Validate day_number + grace period ───────────────────────────────
  if (day_number < 1 || day_number > programDays) {
    return NextResponse.json({ error: 'day_number không hợp lệ.' }, { status: 400 })
  }

  const startDate = enrollment.started_at.slice(0, 10) // YYYY-MM-DD
  const expectedDate = shiftDate(startDate, day_number - 1)
  const today = todayUTC()
  const yesterday = shiftDate(today, -1)

  if (expectedDate > today) {
    return NextResponse.json({ error: 'Không thể check-in ngày tương lai.' }, { status: 400 })
  }
  if (expectedDate < yesterday) {
    return NextResponse.json(
      { error: 'Grace period đã hết – chỉ check-in được hôm nay hoặc hôm qua.' },
      { status: 400 }
    )
  }

  // workout_date = ngày thực tế của bài tập (today hoặc yesterday nếu dùng grace)
  const workoutDate = expectedDate

  // ─── 5. Insert daily_checkin ─────────────────────────────────────────────────
  const { data: checkin, error: checkinError } = await service
    .from('daily_checkins')
    .insert({
      enrollment_id,
      user_id: user.id,
      cohort_id: enrollment.cohort_id ?? null,
      day_number,
      workout_date: workoutDate,
      mode,
      feeling: feeling ?? null,
      feeling_note: feeling_note ?? null,
      duration_minutes: duration_minutes ?? null,
    })
    .select()
    .single()

  if (checkinError) {
    if (checkinError.code === '23505') {
      return NextResponse.json({ error: 'Ngày này đã check-in rồi.' }, { status: 409 })
    }
    console.error('[checkin] insert daily_checkins:', checkinError)
    return NextResponse.json({ error: 'Không thể lưu check-in.' }, { status: 500 })
  }

  // ─── 6 & 7. Compute streak update ───────────────────────────────────────────
  const { data: existingStreak } = await service
    .from('streaks')
    .select('*')
    .eq('enrollment_id', enrollment_id)
    .maybeSingle()

  // "previous day" relative to workout_date for streak continuity
  const prevDayStr = shiftDate(workoutDate, -1)
  const prevLastCheckin = existingStreak?.last_checkin_date ?? null

  // Detect comeback BEFORE computing new streak (need original state)
  const isComeback = ((): boolean => {
    if (mode === 'skip' || prevLastCheckin === null) return false
    if (prevLastCheckin >= prevDayStr) return false
    // count missed days between last check-in and current workout_date
    const msPerDay = 1000 * 60 * 60 * 24
    const lastMs = new Date(prevLastCheckin + 'T00:00:00Z').getTime()
    const workoutMs = new Date(workoutDate + 'T00:00:00Z').getTime()
    const daysMissed = Math.round((workoutMs - lastMs) / msPerDay) - 1
    return daysMissed >= 2
  })()

  // Build new streak values
  const prev = existingStreak ?? {
    current_streak: 0,
    longest_streak: 0,
    total_completed_days: 0,
    total_hard_days: 0,
    total_light_days: 0,
    total_recovery_days: 0,
    total_skip_days: 0,
    last_checkin_date: null,
    streak_started_at: null,
  }

  let newCurrentStreak = prev.current_streak
  let newStreakStartedAt = prev.streak_started_at

  if (mode !== 'skip') {
    if (prevLastCheckin === null) {
      // First ever check-in
      newCurrentStreak = 1
      newStreakStartedAt = workoutDate
    } else if (prevLastCheckin === prevDayStr) {
      // Consecutive day
      newCurrentStreak = prev.current_streak + 1
    } else {
      // Streak broken (missed 1+ days) → reset
      newCurrentStreak = 1
      newStreakStartedAt = workoutDate
    }
  }

  const newLongestStreak = Math.max(newCurrentStreak, prev.longest_streak)

  const streakUpsert = {
    enrollment_id,
    user_id: user.id,
    current_streak: newCurrentStreak,
    longest_streak: newLongestStreak,
    total_completed_days: mode !== 'skip' ? prev.total_completed_days + 1 : prev.total_completed_days,
    total_hard_days: mode === 'hard' ? prev.total_hard_days + 1 : prev.total_hard_days,
    total_light_days: mode === 'light' ? prev.total_light_days + 1 : prev.total_light_days,
    total_recovery_days: mode === 'recovery' ? prev.total_recovery_days + 1 : prev.total_recovery_days,
    total_skip_days: mode === 'skip' ? prev.total_skip_days + 1 : prev.total_skip_days,
    last_checkin_date: mode !== 'skip' ? workoutDate : prev.last_checkin_date,
    streak_started_at: newStreakStartedAt,
    updated_at: new Date().toISOString(),
  }

  // ─── 8. Upsert streak (service_role — bypasses RLS) ─────────────────────────
  const { data: updatedStreak, error: streakError } = await service
    .from('streaks')
    .upsert(streakUpsert, { onConflict: 'enrollment_id' })
    .select()
    .single()

  if (streakError) {
    console.error('[checkin] upsert streaks:', streakError)
    // Non-fatal — continue
  }

  // ─── 9. Update enrollment.current_day ───────────────────────────────────────
  const { error: enrollmentUpdateError } = await service
    .from('enrollments')
    .update({ current_day: day_number })
    .eq('id', enrollment_id)

  if (enrollmentUpdateError) {
    console.error('[checkin] update enrollment current_day:', enrollmentUpdateError)
  }

  // ─── 10. Check and insert milestones ─────────────────────────────────────────
  type MilestoneRow = {
    enrollment_id: string
    user_id: string
    milestone_type: string
    metadata: Record<string, unknown>
  }

  const milestonesToInsert: MilestoneRow[] = []
  const totalCompleted = updatedStreak?.total_completed_days ?? streakUpsert.total_completed_days

  if (mode !== 'skip') {
    // first_checkin
    if (totalCompleted === 1) {
      milestonesToInsert.push({ enrollment_id, user_id: user.id, milestone_type: 'first_checkin', metadata: {} })
    }

    // streak milestones
    for (const target of [3, 7, 14, 21]) {
      if (newCurrentStreak === target) {
        milestonesToInsert.push({ enrollment_id, user_id: user.id, milestone_type: `streak_${target}`, metadata: { streak: target } })
      }
    }

    // comeback
    if (isComeback) {
      milestonesToInsert.push({ enrollment_id, user_id: user.id, milestone_type: 'comeback', metadata: {} })
    }

    // all_hard: 7 most recent check-ins are all 'hard' (including this one)
    if (mode === 'hard') {
      const { data: recentCheckins } = await service
        .from('daily_checkins')
        .select('mode')
        .eq('enrollment_id', enrollment_id)
        .order('day_number', { ascending: false })
        .limit(7)

      if (recentCheckins?.length === 7 && recentCheckins.every(c => c.mode === 'hard')) {
        milestonesToInsert.push({ enrollment_id, user_id: user.id, milestone_type: 'all_hard', metadata: {} })
      }
    }

    // week_complete: all 7 days in current program-week checked in
    const weekNumber = Math.ceil(day_number / 7)
    const weekStartDay = (weekNumber - 1) * 7 + 1
    const weekEndDay = weekNumber * 7
    const { count: weekCheckinCount } = await service
      .from('daily_checkins')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollment_id)
      .gte('day_number', weekStartDay)
      .lte('day_number', weekEndDay)

    if (weekCheckinCount === 7) {
      milestonesToInsert.push({ enrollment_id, user_id: user.id, milestone_type: 'week_complete', metadata: { week: weekNumber } })
    }

    // halfway
    const halfwayDay = Math.ceil(programDays / 2)
    if (day_number === halfwayDay) {
      milestonesToInsert.push({ enrollment_id, user_id: user.id, milestone_type: 'halfway', metadata: { program_days: programDays } })
    }

    // final_week: entering last 7 days
    if (day_number > programDays - 7) {
      milestonesToInsert.push({ enrollment_id, user_id: user.id, milestone_type: 'final_week', metadata: {} })
    }

    // program_complete
    if (day_number === programDays) {
      milestonesToInsert.push({ enrollment_id, user_id: user.id, milestone_type: 'program_complete', metadata: {} })
    }
  }

  let newMilestones: { milestone_type: string; achieved_at: string }[] = []

  if (milestonesToInsert.length > 0) {
    const { data: insertedMilestones, error: milestoneError } = await service
      .from('completion_milestones')
      .upsert(milestonesToInsert, { onConflict: 'enrollment_id,milestone_type', ignoreDuplicates: true })
      .select('milestone_type, achieved_at')

    if (milestoneError) {
      console.error('[checkin] upsert completion_milestones:', milestoneError)
    } else if (insertedMilestones) {
      newMilestones = insertedMilestones
    }
  }

  // ─── 11. Mark enrollment completed ──────────────────────────────────────────
  if (day_number === programDays && mode !== 'skip') {
    const { error: completeError } = await service
      .from('enrollments')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', enrollment_id)

    if (completeError) {
      console.error('[checkin] mark enrollment completed:', completeError)
    }
  }

  // ─── 12. Resolve open dropout signals ───────────────────────────────────────
  const { error: resolveError } = await service
    .from('dropout_signals')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: 'user_returned',
    })
    .eq('enrollment_id', enrollment_id)
    .eq('resolved', false)

  if (resolveError) {
    console.error('[checkin] resolve dropout_signals:', resolveError)
  }

  // ─── 13. Fetch completion rate ───────────────────────────────────────────────
  const { data: completionRate, error: rateError } = await service
    .rpc('get_completion_rate', { p_enrollment_id: enrollment_id })

  if (rateError) {
    console.error('[checkin] get_completion_rate rpc:', rateError)
  }

  // ─── 14. Response ────────────────────────────────────────────────────────────
  // Bump the analytics cache so the admin dashboard reflects the new check-in
  revalidateAnalytics()

  return NextResponse.json({
    checkin,
    streak: {
      current_streak: updatedStreak?.current_streak ?? newCurrentStreak,
      longest_streak: updatedStreak?.longest_streak ?? newLongestStreak,
      total_completed_days: updatedStreak?.total_completed_days ?? totalCompleted,
    },
    new_milestones: newMilestones,
    completion_rate: completionRate ?? null,
  })
}
