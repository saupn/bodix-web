import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { TRIAL_DAYS } from '@/lib/trial/utils'

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

  // --- Kiểm tra user đã có trial đang active chưa ---
  const { data: existingTrial } = await supabase
    .from('enrollments')
    .select('id, program_id, status, enrolled_at')
    .eq('user_id', user.id)
    .eq('status', 'trial')
    .limit(1)
    .maybeSingle()

  if (existingTrial) {
    return NextResponse.json(
      {
        error: 'Bạn đang có một trial đang hoạt động. Hoàn thành hoặc kết thúc trial hiện tại trước.',
        enrollment: existingTrial,
      },
      { status: 409 }
    )
  }

  // --- Tạo enrollment ---
  const { data: enrollment, error: enrollError } = await supabase
    .from('enrollments')
    .insert({
      user_id: user.id,
      program_id: programId,
      status: 'trial',
    })
    .select('id, user_id, program_id, status, enrolled_at')
    .single()

  if (enrollError || !enrollment) {
    console.error('[trial/start] enrollment insert failed:', enrollError)
    return NextResponse.json({ error: 'Không thể tạo trial. Vui lòng thử lại.' }, { status: 500 })
  }

  // --- Cập nhật profile: trial_started_at và trial_ends_at ---
  // Dùng service client để bypass RLS trên profiles
  const trialStartedAt = new Date().toISOString()
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const service = createServiceClient()
  const { error: profileError } = await service
    .from('profiles')
    .update({ trial_started_at: trialStartedAt, trial_ends_at: trialEndsAt })
    .eq('id', user.id)

  if (profileError) {
    console.error('[trial/start] profile update failed:', profileError)
    // Không roll back enrollment — trial vẫn hoạt động, chỉ thiếu timestamps trên profile
  }

  return NextResponse.json({
    success: true,
    enrollment,
    trial_ends_at: trialEndsAt,
    message: `Trial ${program.name} đã bắt đầu. Bạn có ${TRIAL_DAYS} ngày trải nghiệm.`,
  })
}
