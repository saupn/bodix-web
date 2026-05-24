import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTrialStatus, canAccessTrialContent, TRIAL_ACCESSIBLE_STATUSES } from '@/lib/trial/utils'

export async function GET() {
  // --- Auth ---
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  // --- Lấy profile (trial timestamps) ---
  const { data: profile } = await supabase
    .from('profiles')
    .select('trial_started_at, trial_ends_at, bodix_start_date, bodix_current_day')
    .eq('id', user.id)
    .single()

  const trialStatus = getTrialStatus({
    trial_ends_at: profile?.trial_ends_at ?? null,
  })

  // --- Lấy enrollment đang trial (kèm thông tin program) ---
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select(
      `
      id,
      program_id,
      status,
      enrolled_at,
      started_at,
      current_day,
      program:programs (
        id,
        slug,
        name,
        description,
        duration_days,
        price_vnd,
        features
      )
    `
    )
    .eq('user_id', user.id)
    .in('status', Array.from(TRIAL_ACCESSIBLE_STATUSES))
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // --- Lấy hoạt động trial gần đây ---
  const { data: activities } = await supabase
    .from('trial_activities')
    .select('id, activity_type, metadata, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  // --- Tính canAccess dựa trên cả enrollment status lẫn thời hạn ---
  const canAccess = enrollment
    ? canAccessTrialContent({
        status: enrollment.status,
        trial_ends_at: profile?.trial_ends_at ?? null,
      })
    : false

  // --- Tổng hợp số hoạt động theo loại ---
  const activitySummary = (activities ?? []).reduce<Record<string, number>>(
    (acc, a) => {
      acc[a.activity_type] = (acc[a.activity_type] ?? 0) + 1
      return acc
    },
    {}
  )

  // --- Cohort upcoming gần nhất cho program đang trial ---
  // Dùng cho UI hiển thị "Đợt tập gần nhất: DD/M/YYYY" trên upgrade CTA.
  let upcomingCohort: { id: string; name: string; start_date: string } | null = null
  if (enrollment?.program_id) {
    const todayStr = new Date().toISOString().split('T')[0]
    const { data: cohort } = await supabase
      .from('cohorts')
      .select('id, name, start_date')
      .eq('program_id', enrollment.program_id)
      .eq('status', 'upcoming')
      .gte('start_date', todayStr)
      .order('start_date', { ascending: true })
      .limit(1)
      .maybeSingle()
    upcomingCohort = cohort ?? null
  }

  // --- Số ngày trial đã check-in (count complete_trial_day activities) ---
  const completedTrialDays = (activities ?? []).filter(
    (a) => a.activity_type === 'complete_trial_day',
  ).length

  return NextResponse.json({
    is_trial: trialStatus.isTrial,
    is_expired: trialStatus.isExpired,
    trial_started_at: profile?.trial_started_at ?? null,
    trial_ends_at: profile?.trial_ends_at ?? null,
    bodix_start_date: profile?.bodix_start_date ?? null,
    bodix_current_day: profile?.bodix_current_day ?? null,
    days_remaining: trialStatus.daysRemaining,
    hours_remaining: trialStatus.hoursRemaining,
    can_access_content: canAccess,
    program: enrollment?.program ?? null,
    enrollment: enrollment
      ? {
          id: enrollment.id,
          program_id: enrollment.program_id,
          status: enrollment.status,
          enrolled_at: enrollment.enrolled_at,
          started_at: enrollment.started_at,
          current_day: enrollment.current_day,
        }
      : null,
    activity_summary: activitySummary,
    activities: activities ?? [],
    upcoming_cohort: upcomingCohort,
    completed_trial_days: completedTrialDays,
  })
}
