import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  // ─── Auth ────────────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  // ─── Active enrollment + program ─────────────────────────────────────────────
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('id, current_day, started_at, cohort_id, programs(name, duration_days)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (enrollmentError) {
    console.error('[my-stats] enrollment query:', enrollmentError)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }
  if (!enrollment) {
    return NextResponse.json({ error: 'Không có chương trình đang active.' }, { status: 404 })
  }

  const program = enrollment.programs as unknown as { name: string; duration_days: number }
  const enrollmentId = enrollment.id

  // ─── Parallel queries ─────────────────────────────────────────────────────────
  const [streakResult, checkinsResult, milestonesResult, rateResult] = await Promise.all([
    supabase
      .from('streaks')
      .select('current_streak, longest_streak, total_completed_days, total_hard_days, total_light_days, total_recovery_days, total_skip_days')
      .eq('enrollment_id', enrollmentId)
      .maybeSingle(),

    supabase
      .from('daily_checkins')
      .select('id, day_number, workout_date, mode, feeling, feeling_note, duration_minutes, completed_at')
      .eq('enrollment_id', enrollmentId)
      .order('day_number', { ascending: true }),

    supabase
      .from('completion_milestones')
      .select('milestone_type, achieved_at, metadata')
      .eq('enrollment_id', enrollmentId)
      .order('achieved_at', { ascending: true }),

    supabase.rpc('get_completion_rate', { p_enrollment_id: enrollmentId }),
  ])

  if (streakResult.error) console.error('[my-stats] streak query:', streakResult.error)
  if (checkinsResult.error) console.error('[my-stats] checkins query:', checkinsResult.error)
  if (milestonesResult.error) console.error('[my-stats] milestones query:', milestonesResult.error)
  if (rateResult.error) console.error('[my-stats] get_completion_rate rpc:', rateResult.error)

  const rateData = rateResult.data as Record<string, unknown> | null
  const completionRate: number = typeof rateData?.completion_rate === 'number'
    ? rateData.completion_rate
    : 0

  const daysRemaining = Math.max(program.duration_days - (enrollment.current_day ?? 0), 0)

  return NextResponse.json({
    enrollment_id: enrollmentId,
    cohort_id: enrollment.cohort_id ?? null,
    program_name: program.name,
    current_day: enrollment.current_day ?? 0,
    total_days: program.duration_days,
    streak: streakResult.data ?? {
      current_streak: 0,
      longest_streak: 0,
      total_completed_days: 0,
      total_hard_days: 0,
      total_light_days: 0,
      total_recovery_days: 0,
      total_skip_days: 0,
    },
    completion_rate: completionRate,
    checkins: checkinsResult.data ?? [],
    milestones: milestonesResult.data ?? [],
    days_remaining: daysRemaining,
  })
}
