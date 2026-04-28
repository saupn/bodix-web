import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTrialStatus, canAccessTrialContent } from '@/lib/trial/utils'

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
    .eq('status', 'trial')
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
  })
}
