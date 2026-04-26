import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

interface AcknowledgeBody {
  intervention_id: string
  action: 'return' | 'pause'
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  let body: AcknowledgeBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const { intervention_id, action } = body

  if (!intervention_id || !action) {
    return NextResponse.json({ error: 'Thiếu intervention_id hoặc action.' }, { status: 400 })
  }
  if (action !== 'return' && action !== 'pause') {
    return NextResponse.json({ error: 'action phải là "return" hoặc "pause".' }, { status: 400 })
  }

  // ── Verify intervention belongs to this user ──────────────────────────────────
  // Use anon client — rescue_interventions RLS allows user to SELECT own rows
  const { data: intervention, error: fetchError } = await supabase
    .from('rescue_interventions')
    .select('id, enrollment_id, user_id, outcome')
    .eq('id', intervention_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchError) {
    console.error('[rescue/acknowledge] intervention fetch:', fetchError)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }
  if (!intervention) {
    return NextResponse.json({ error: 'Intervention không tồn tại.' }, { status: 404 })
  }
  if (intervention.outcome !== 'pending') {
    return NextResponse.json({ error: 'Intervention này đã được xử lý rồi.' }, { status: 409 })
  }

  const now = new Date().toISOString()
  const service = createServiceClient()
  const enrollmentId = intervention.enrollment_id

  if (action === 'return') {
    // ── User commits to returning ───────────────────────────────────────────────
    const [interventionUpdate, signalResolve] = await Promise.all([
      service
        .from('rescue_interventions')
        .update({ outcome: 'user_returned', outcome_at: now })
        .eq('id', intervention_id),

      // Resolve all open dropout signals for this enrollment
      service
        .from('dropout_signals')
        .update({ resolved: true, resolved_at: now, resolved_by: 'user_returned' })
        .eq('enrollment_id', enrollmentId)
        .eq('resolved', false),
    ])

    if (interventionUpdate.error) {
      console.error('[rescue/acknowledge] return – intervention update:', interventionUpdate.error)
      return NextResponse.json({ error: 'Không thể cập nhật.' }, { status: 500 })
    }
    if (signalResolve.error) {
      console.error('[rescue/acknowledge] return – signal resolve:', signalResolve.error)
      // Non-fatal — intervention was updated, signals can be resolved later
    }

    return NextResponse.json({
      success: true,
      action: 'return',
      message: 'Chào mừng bạn trở lại! Hành trình vẫn đang chờ.',
    })
  }

  // ── action === 'pause' ───────────────────────────────────────────────────────
  const [interventionUpdate, enrollmentUpdate] = await Promise.all([
    service
      .from('rescue_interventions')
      .update({ outcome: 'user_paused', outcome_at: now })
      .eq('id', intervention_id),

    service
      .from('enrollments')
      .update({ status: 'paused' })
      .eq('id', enrollmentId)
      .eq('user_id', user.id), // double-check ownership
  ])

  if (interventionUpdate.error) {
    console.error('[rescue/acknowledge] pause – intervention update:', interventionUpdate.error)
    return NextResponse.json({ error: 'Không thể cập nhật.' }, { status: 500 })
  }
  if (enrollmentUpdate.error) {
    console.error('[rescue/acknowledge] pause – enrollment update:', enrollmentUpdate.error)
    return NextResponse.json({ error: 'Không thể tạm dừng chương trình.' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    action: 'pause',
    message: 'Chương trình đã được tạm dừng. Bạn có thể tiếp tục bất cứ lúc nào.',
  })
}
