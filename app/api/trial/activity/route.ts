import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { VALID_ACTIVITY_TYPES, type ActivityType } from '@/lib/trial/utils'

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
  let body: { program_id?: unknown; activity_type?: unknown; metadata?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (typeof body.program_id !== 'string' || !UUID_RE.test(body.program_id)) {
    return NextResponse.json({ error: 'program_id không hợp lệ.' }, { status: 400 })
  }

  if (
    typeof body.activity_type !== 'string' ||
    !VALID_ACTIVITY_TYPES.includes(body.activity_type as ActivityType)
  ) {
    return NextResponse.json(
      {
        error: `activity_type không hợp lệ. Các giá trị hợp lệ: ${VALID_ACTIVITY_TYPES.join(', ')}.`,
      },
      { status: 400 }
    )
  }

  const programId = body.program_id
  const activityType = body.activity_type as ActivityType
  const metadata =
    body.metadata !== undefined && typeof body.metadata === 'object' && body.metadata !== null
      ? body.metadata
      : {}

  // --- Kiểm tra user đang có trial active cho program này ---
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('program_id', programId)
    .eq('status', 'trial')
    .maybeSingle()

  if (!enrollment) {
    return NextResponse.json(
      { error: 'Bạn không có trial đang hoạt động cho chương trình này.' },
      { status: 403 }
    )
  }

  // --- Ghi nhận hoạt động ---
  const { data: activity, error: insertError } = await supabase
    .from('trial_activities')
    .insert({
      user_id: user.id,
      program_id: programId,
      activity_type: activityType,
      metadata,
    })
    .select('id, activity_type, metadata, created_at')
    .single()

  if (insertError || !activity) {
    console.error('[trial/activity] insert failed:', insertError)
    return NextResponse.json({ error: 'Không thể ghi nhận hoạt động.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, activity })
}
