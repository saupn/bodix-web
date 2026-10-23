import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isBuddyMatchingEnabled } from '@/lib/settings'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })

  // Cờ toàn hệ thống — tắt thì UI ẩn phần "Tìm buddy" (cặp đã ghép trước đó
  // vẫn hiển thị bình thường).
  // Lấy enrollment trial / paid_waiting_cohort / active (3 state có buddy logic)
  // song song với cờ hệ thống.
  const [matchingEnabled, { data: enrollment }] = await Promise.all([
    isBuddyMatchingEnabled(),
    supabase
      .from('enrollments')
      .select('id, cohort_id, current_day, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'paid_waiting_cohort', 'trial'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!enrollment) {
    return NextResponse.json({ has_buddy: false, enrollment_status: null, matching_enabled: matchingEnabled })
  }

  // Trial → không có buddy, trả về enrollment_status để BuddyCard hiện preview
  if (enrollment.status === 'trial' || !enrollment.cohort_id) {
    return NextResponse.json({
      has_buddy: false,
      matching_enabled: matchingEnabled,
      enrollment_status: enrollment.status,
      cohort_id: enrollment.cohort_id ?? null,
    })
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
      matching_enabled: matchingEnabled,
      enrollment_status: enrollment.status,
      cohort_id: enrollment.cohort_id,
      enrollment_id: enrollment.id,
    })
  }

  const buddyId = pair.user_a === user.id ? pair.user_b : pair.user_a

  // Thông tin buddy + enrollment cùng cohort của buddy (kèm streak và check-in
  // hôm nay qua embed) → một đợt song song thay vì 4 query nối tiếp.
  const today = new Date().toISOString().split('T')[0]
  const [{ data: buddyProfile }, { data: buddyEnrollment }] = await Promise.all([
    service
      .from('profiles')
      .select('id, full_name, channel_user_id')
      .eq('id', buddyId)
      .single(),
    // Buddy enrollment cùng cohort (active hoặc paid_waiting_cohort)
    service
      .from('enrollments')
      .select('id, streaks(current_streak), daily_checkins(id)')
      .eq('user_id', buddyId)
      .eq('cohort_id', enrollment.cohort_id)
      .in('status', ['active', 'paid_waiting_cohort'])
      .eq('daily_checkins.workout_date', today)
      .limit(1, { referencedTable: 'daily_checkins' })
      .maybeSingle(),
  ])

  const embedded = buddyEnrollment as unknown as {
    streaks: { current_streak: number } | { current_streak: number }[] | null
    daily_checkins: { id: string }[] | null
  } | null
  const buddyCheckedInToday = (embedded?.daily_checkins?.length ?? 0) > 0
  const buddyStreak = Array.isArray(embedded?.streaks)
    ? embedded.streaks[0] ?? null
    : embedded?.streaks ?? null

  return NextResponse.json({
    has_buddy: true,
    matching_enabled: matchingEnabled,
    enrollment_status: enrollment.status,
    buddy: {
      id: buddyProfile?.id,
      name: buddyProfile?.full_name,
      has_zalo: !!buddyProfile?.channel_user_id,
      checked_in_today: buddyCheckedInToday,
      current_streak: buddyStreak?.current_streak ?? 0,
    },
    pair_id: pair.id,
    matched_by: pair.matched_by,
    paired_at: pair.created_at,
    cohort_id: enrollment.cohort_id,
    enrollment_id: enrollment.id,
  })
}
