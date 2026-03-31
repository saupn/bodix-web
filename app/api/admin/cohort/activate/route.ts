import { NextResponse, type NextRequest } from 'next/server'
import { verifyAdmin } from '@/lib/admin/verify-admin'
import { createServiceClient } from '@/lib/supabase/service'
import { sendViaZalo } from '@/lib/messaging/adapters/zalo'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin()
  if ('error' in auth) return auth.error

  let body: { cohort_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (typeof body.cohort_id !== 'string' || !UUID_RE.test(body.cohort_id)) {
    return NextResponse.json({ error: 'cohort_id không hợp lệ.' }, { status: 400 })
  }

  const cohortId = body.cohort_id
  const service = createServiceClient()

  // Fetch cohort
  const { data: cohort, error: cohortError } = await service
    .from('cohorts')
    .select('id, name, start_date, program_id, status')
    .eq('id', cohortId)
    .single()

  if (cohortError || !cohort) {
    return NextResponse.json({ error: 'Cohort không tồn tại.' }, { status: 404 })
  }

  // Activate cohort
  await service
    .from('cohorts')
    .update({ status: 'active' })
    .eq('id', cohortId)

  // Find all paid_waiting_cohort enrollments for this cohort
  const { data: enrollments, error: enrollError } = await service
    .from('enrollments')
    .select('id, user_id')
    .eq('cohort_id', cohortId)
    .eq('status', 'paid_waiting_cohort')

  if (enrollError) {
    console.error('[admin/cohort/activate] fetch enrollments:', enrollError)
    return NextResponse.json({ error: 'Lỗi khi lấy enrollments.' }, { status: 500 })
  }

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({
      activated: 0,
      cohort_status: 'active',
      message: 'Cohort activated, nhưng không có enrollment nào ở paid_waiting_cohort.',
    })
  }

  // Activate all enrollments
  const { error: updateError } = await service
    .from('enrollments')
    .update({
      status: 'active',
      current_day: 0,
      started_at: cohort.start_date,
    })
    .eq('cohort_id', cohortId)
    .eq('status', 'paid_waiting_cohort')

  if (updateError) {
    console.error('[admin/cohort/activate] update enrollments:', updateError)
    return NextResponse.json({ error: 'Lỗi khi activate enrollments.' }, { status: 500 })
  }

  // Update cohort member count
  await service
    .from('cohorts')
    .update({ current_members: enrollments.length })
    .eq('id', cohortId)

  // Send Zalo notification to each user
  let sentCount = 0
  let errorCount = 0

  const startDateFormatted = cohort.start_date

  for (const enrollment of enrollments) {
    const { data: profile } = await service
      .from('profiles')
      .select('full_name, channel_user_id')
      .eq('id', enrollment.user_id)
      .single()

    if (!profile?.channel_user_id) continue

    const message =
      `🚀 Ngày ${startDateFormatted}, bạn bắt đầu Ngày 1 cùng ${enrollments.length} người!\n` +
      `Sáng hôm đó bạn sẽ nhận tin nhắc tập đầu tiên. Chuẩn bị tinh thần nhé! 💪`

    try {
      const result = await sendViaZalo(profile.channel_user_id, message)
      if (result.success) sentCount++
      else errorCount++
    } catch {
      errorCount++
    }

    await new Promise(r => setTimeout(r, 100))
  }

  return NextResponse.json({
    activated: enrollments.length,
    cohort_status: 'active',
    start_date: cohort.start_date,
    zalo_sent: sentCount,
    zalo_errors: errorCount,
  })
}
