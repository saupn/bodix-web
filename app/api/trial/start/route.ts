import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { TRIAL_DAYS, hasMinDaysBeforeCohortForTrial } from '@/lib/trial/utils'
import { sendViaZalo } from '@/lib/messaging/adapters/zalo'
import { getVietnamTomorrowDateString } from '@/lib/date/vietnam'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  // --- Auth ---
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  // --- Parse body ---
  let body: { program_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (typeof body.program_id !== 'string' || !UUID_RE.test(body.program_id)) {
    return NextResponse.json({ error: 'program_id không hợp lệ.' }, { status: 400 })
  }

  const programId = body.program_id

  // --- Kiểm tra program tồn tại và active ---
  const { data: program, error: programError } = await supabase
    .from('programs')
    .select('id, name, slug, is_active')
    .eq('id', programId)
    .eq('is_active', true)
    .single()

  if (programError || !program) {
    return NextResponse.json({ error: 'Chương trình không tồn tại hoặc đã đóng.' }, { status: 404 })
  }

  // --- Kiểm tra user đã từng trial chưa (bất kỳ status nào) ---
  const { data: existingEnrollments } = await supabase
    .from('enrollments')
    .select('id, status')
    .eq('user_id', user.id)
    .in('status', ['trial', 'trial_completed', 'pending_payment', 'paid_waiting_cohort', 'active', 'completed'])
    .limit(1)

  if (existingEnrollments && existingEnrollments.length > 0) {
    return NextResponse.json(
      { error: 'Bạn đã tập thử rồi.' },
      { status: 409 }
    )
  }

  const service = createServiceClient()
  const { data: nextCohort } = await service
    .from('cohorts')
    .select('start_date')
    .eq('program_id', programId)
    .eq('status', 'upcoming')
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (nextCohort?.start_date && !hasMinDaysBeforeCohortForTrial(nextCohort.start_date)) {
    return NextResponse.json(
      {
        error:
          'Đợt tập sắp tới quá gần – không đủ 3 ngày cho tập thử. Vui lòng chờ đợt cohort tiếp theo.',
        code: 'cohort_too_soon',
      },
      { status: 409 }
    )
  }

  const startDate = getVietnamTomorrowDateString()
  const startedAt = `${startDate}T00:00:00+07:00`

  // --- Tạo enrollment — bắt đầu từ ngày mai (current_day 0 = chưa vào ngày 1) ---
  const { data: enrollment, error: enrollError } = await supabase
    .from('enrollments')
    .insert({
      user_id: user.id,
      program_id: programId,
      status: 'trial',
      current_day: 0,
      started_at: startedAt,
    })
    .select('id, user_id, program_id, status, enrolled_at')
    .single()

  if (enrollError || !enrollment) {
    console.error('[trial/start] enrollment insert failed:', enrollError)
    return NextResponse.json({ error: 'Không thể tạo trial. Vui lòng thử lại.' }, { status: 500 })
  }

  // --- Cập nhật profile: trial_started_at và trial_ends_at ---
  const trialStartedAt = new Date().toISOString()
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { error: profileError } = await service
    .from('profiles')
    .update({
      trial_started_at: trialStartedAt,
      trial_ends_at: trialEndsAt,
      bodix_start_date: startDate,
      bodix_current_day: 0,
    })
    .eq('id', user.id)

  if (profileError) {
    console.error('[trial/start] profile update failed:', profileError)
  }

  // --- Gửi Zalo thông báo ---
  const { data: profileData } = await service
    .from('profiles')
    .select('channel_user_id, full_name')
    .eq('id', user.id)
    .single()

  if (profileData?.channel_user_id) {
    const name = profileData.full_name?.split(' ').pop() || profileData.full_name || 'bạn'
    sendViaZalo(
      profileData.channel_user_id,
      `🎉 ${name} đã đăng ký tập thử 3 ngày! Chương trình bắt đầu ngày ${startDate.split('-').reverse().join('/')}.\n\nNgày mai lúc 6:30 bạn sẽ nhận tin nhắn bài tập đầu tiên qua Zalo. Chuẩn bị tinh thần nhé! 💪`
    ).catch(err => console.error('[trial/start] zalo send:', err))
  }

  return NextResponse.json({
    success: true,
    enrollment,
    trial_ends_at: trialEndsAt,
    message: `Trial ${program.name} đã bắt đầu. Bạn có ${TRIAL_DAYS} ngày trải nghiệm.`,
  })
}
