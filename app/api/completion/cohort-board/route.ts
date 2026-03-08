import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** "Nguyen Van Minh" → "Nguyen M." for privacy */
function maskName(fullName: string | null | undefined): string {
  if (!fullName?.trim()) return 'Thành viên'
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  const lastPart = parts[parts.length - 1]
  return `${parts[0]} ${lastPart[0]}.`
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // ─── Auth ────────────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  // ─── Query params ─────────────────────────────────────────────────────────────
  const cohortId = request.nextUrl.searchParams.get('cohort_id')
  if (!cohortId) {
    return NextResponse.json({ error: 'Thiếu cohort_id.' }, { status: 400 })
  }

  // ─── Verify caller is a member of this cohort ─────────────────────────────────
  const { data: myEnrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('cohort_id', cohortId)
    .eq('status', 'active')
    .maybeSingle()

  if (!myEnrollment) {
    return NextResponse.json({ error: 'Bạn không thuộc cohort này.' }, { status: 403 })
  }

  // ─── Cohort info + program duration ───────────────────────────────────────────
  const { data: cohort, error: cohortError } = await supabase
    .from('cohorts')
    .select('id, name, programs(duration_days)')
    .eq('id', cohortId)
    .single()

  if (cohortError || !cohort) {
    return NextResponse.json({ error: 'Cohort không tồn tại.' }, { status: 404 })
  }

  const program = cohort.programs as unknown as { duration_days: number } | null
  const programDurationDays = program?.duration_days ?? 84

  // ─── All active enrollments in cohort + profiles ──────────────────────────────
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('enrollments')
    .select('id, user_id, profiles(full_name)')
    .eq('cohort_id', cohortId)
    .eq('status', 'active')

  if (enrollmentsError) {
    console.error('[cohort-board] enrollments query:', enrollmentsError)
    return NextResponse.json({ error: 'Lỗi truy vấn thành viên.' }, { status: 500 })
  }

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({
      cohort_id: cohortId,
      cohort_name: cohort.name,
      date: todayUTC(),
      stats: { total_members: 0, completed_today: 0, avg_completion_rate: 0 },
      members: [],
    })
  }

  const enrollmentIds = enrollments.map(e => e.id)
  const today = todayUTC()

  // ─── Parallel: streaks + today's check-ins + cohort aggregate stats ───────────
  const [streaksResult, checkinsResult, statsResult] = await Promise.all([
    supabase
      .from('streaks')
      .select('enrollment_id, current_streak, total_completed_days')
      .in('enrollment_id', enrollmentIds),

    supabase
      .from('daily_checkins')
      .select('enrollment_id, user_id, mode')
      .in('enrollment_id', enrollmentIds)
      .eq('workout_date', today),

    supabase.rpc('get_cohort_completion', { p_cohort_id: cohortId }),
  ])

  if (streaksResult.error) console.error('[cohort-board] streaks query:', streaksResult.error)
  if (checkinsResult.error) console.error('[cohort-board] checkins query:', checkinsResult.error)
  if (statsResult.error) console.error('[cohort-board] get_cohort_completion rpc:', statsResult.error)

  // Index by enrollment_id for O(1) lookup
  const streakByEnrollment = new Map(
    (streaksResult.data ?? []).map(s => [
      s.enrollment_id,
      { current_streak: s.current_streak, total_completed_days: s.total_completed_days ?? 0 },
    ])
  )
  const checkinByEnrollment = new Map(
    (checkinsResult.data ?? []).map(c => [c.enrollment_id, c.mode as string])
  )

  // ─── Build member list ────────────────────────────────────────────────────────
  const members = enrollments.map(enrollment => {
    const profile = enrollment.profiles as unknown as { full_name: string | null } | null
    const streakData = streakByEnrollment.get(enrollment.id) ?? { current_streak: 0, total_completed_days: 0 }
    const currentStreak = streakData.current_streak
    const totalCompleted = streakData.total_completed_days
    const modeToday = checkinByEnrollment.get(enrollment.id) ?? null
    const completionRate = programDurationDays > 0
      ? Math.round((totalCompleted / programDurationDays) * 100)
      : 0

    return {
      user_id: enrollment.user_id,
      display_name: maskName(profile?.full_name),
      avatar_url: null, // profiles table does not store avatar_url
      checked_in_today: modeToday !== null,
      mode_today: modeToday,
      current_streak: currentStreak,
      completion_rate: completionRate,
      is_highlighted: currentStreak >= 7,
    }
  })

  // Sort: checked-in first, then by streak desc
  members.sort((a, b) => {
    if (a.checked_in_today !== b.checked_in_today) return a.checked_in_today ? -1 : 1
    return b.current_streak - a.current_streak
  })

  // ─── Aggregate stats ──────────────────────────────────────────────────────────
  const rpcStats = statsResult.data as Record<string, unknown> | null
  const stats = {
    total_members: typeof rpcStats?.total_members === 'number' ? rpcStats.total_members : enrollments.length,
    completed_today: typeof rpcStats?.today_completed === 'number' ? rpcStats.today_completed : members.filter(m => m.checked_in_today).length,
    avg_completion_rate: typeof rpcStats?.avg_completion_rate === 'number' ? rpcStats.avg_completion_rate : 0,
  }

  const meCheckedIn = members.some(m => m.user_id === user.id && m.checked_in_today)

  return NextResponse.json({
    cohort_id: cohortId,
    cohort_name: cohort.name,
    date: today,
    program_duration_days: programDurationDays,
    stats,
    members,
    me_checked_in_today: meCheckedIn,
  })
}
