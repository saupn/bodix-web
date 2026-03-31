import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })

  // Lấy enrollment active
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, cohort_id, current_day')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!enrollment?.cohort_id) {
    return NextResponse.json({ has_buddy: false, enrollment: null })
  }

  const service = createServiceClient()

  // Tìm buddy pair (user có thể là user_a hoặc user_b)
  const { data: pair } = await service
    .from('buddy_pairs')
    .select('id, user_a, user_b, status, matched_by, created_at')
    .eq('cohort_id', enrollment.cohort_id)
    .eq('status', 'active')
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .maybeSingle()

  if (!pair) {
    return NextResponse.json({
      has_buddy: false,
      cohort_id: enrollment.cohort_id,
      enrollment_id: enrollment.id,
    })
  }

  const buddyId = pair.user_a === user.id ? pair.user_b : pair.user_a

  // Lấy thông tin buddy
  const { data: buddyProfile } = await service
    .from('profiles')
    .select('id, full_name, channel_user_id')
    .eq('id', buddyId)
    .single()

  // Buddy check-in hôm nay?
  const today = new Date().toISOString().split('T')[0]
  const { data: buddyEnrollment } = await service
    .from('enrollments')
    .select('id')
    .eq('user_id', buddyId)
    .eq('cohort_id', enrollment.cohort_id)
    .eq('status', 'active')
    .maybeSingle()

  let buddyCheckedInToday = false
  if (buddyEnrollment) {
    const { data: checkin } = await service
      .from('daily_checkins')
      .select('id')
      .eq('enrollment_id', buddyEnrollment.id)
      .eq('workout_date', today)
      .limit(1)
      .maybeSingle()
    buddyCheckedInToday = !!checkin
  }

  // Buddy streak
  const { data: buddyStreak } = await service
    .from('streaks')
    .select('current_streak')
    .eq('enrollment_id', buddyEnrollment?.id ?? '')
    .maybeSingle()

  return NextResponse.json({
    has_buddy: true,
    buddy: {
      id: buddyProfile?.id,
      name: buddyProfile?.full_name,
      has_zalo: !!buddyProfile?.channel_user_id,
      checked_in_today: buddyCheckedInToday,
      current_streak: buddyStreak?.current_streak ?? 0,
    },
    pair_id: pair.id,
    matched_by: pair.matched_by,
    cohort_id: enrollment.cohort_id,
    enrollment_id: enrollment.id,
  })
}
