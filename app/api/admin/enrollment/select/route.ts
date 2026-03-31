import { NextResponse, type NextRequest } from 'next/server'
import { verifyAdmin } from '@/lib/admin/verify-admin'
import { createServiceClient } from '@/lib/supabase/service'
import { sendViaZalo } from '@/lib/messaging/adapters/zalo'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin()
  if ('error' in auth) return auth.error

  let body: { enrollment_ids?: unknown; cohort_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  // Validate enrollment_ids
  if (!Array.isArray(body.enrollment_ids) || body.enrollment_ids.length === 0) {
    return NextResponse.json({ error: 'enrollment_ids phải là array không rỗng.' }, { status: 400 })
  }

  const enrollmentIds = body.enrollment_ids as string[]
  if (!enrollmentIds.every(id => typeof id === 'string' && UUID_RE.test(id))) {
    return NextResponse.json({ error: 'enrollment_ids chứa ID không hợp lệ.' }, { status: 400 })
  }

  // Optional cohort_id
  const cohortId = typeof body.cohort_id === 'string' && UUID_RE.test(body.cohort_id)
    ? body.cohort_id
    : null

  const service = createServiceClient()

  // Fetch enrollments that are trial_completed
  const { data: enrollments, error: fetchError } = await service
    .from('enrollments')
    .select('id, user_id, program_id, status, programs(name)')
    .in('id', enrollmentIds)
    .eq('status', 'trial_completed')

  if (fetchError) {
    console.error('[admin/enrollment/select] fetch:', fetchError)
    return NextResponse.json({ error: 'Lỗi khi lấy enrollments.' }, { status: 500 })
  }

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({
      error: 'Không tìm thấy enrollments ở trạng thái trial_completed.',
      selected: 0,
    }, { status: 404 })
  }

  // Fetch cohort info if provided
  let cohortName: string | null = null
  if (cohortId) {
    const { data: cohort } = await service
      .from('cohorts')
      .select('name')
      .eq('id', cohortId)
      .single()
    cohortName = cohort?.name ?? null
  }

  // Update all matched enrollments to pending_payment
  const { error: updateError } = await service
    .from('enrollments')
    .update({
      status: 'pending_payment',
      ...(cohortId ? { cohort_id: cohortId } : {}),
    })
    .in('id', enrollments.map(e => e.id))

  if (updateError) {
    console.error('[admin/enrollment/select] update:', updateError)
    return NextResponse.json({ error: 'Lỗi khi cập nhật enrollments.' }, { status: 500 })
  }

  // Send Zalo to each selected user
  let sentCount = 0
  let errorCount = 0

  for (const enrollment of enrollments) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prog = Array.isArray((enrollment as any).programs) ? (enrollment as any).programs[0] : (enrollment as any).programs
    const programName: string = prog?.name ?? 'BodiX 21'

    const { data: profile } = await service
      .from('profiles')
      .select('full_name, channel_user_id')
      .eq('id', enrollment.user_id)
      .single()

    if (!profile?.channel_user_id) continue

    const name = profile.full_name?.split(' ').pop() || profile.full_name || 'bạn'
    const cohortPart = cohortName ? ` đợt ${cohortName}` : ''
    const message =
      `🎉 Chúc mừng ${name}! Bạn đã được chọn tham gia ${programName}${cohortPart}!\n` +
      `Thanh toán tại bodix.fit/checkout để giữ chỗ.`

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
    selected: enrollments.length,
    zalo_sent: sentCount,
    zalo_errors: errorCount,
  })
}
