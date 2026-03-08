import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  let body: {
    enrollment_id: string
    before_photo_url?: string
    midpoint_photo_url?: string
    overall_progress: number
    visible_changes: string[]
    goal_still_relevant: boolean
    updated_goal?: string
    wants_intensity_change: 'more_hard' | 'keep_same' | 'more_light'
    what_works_well?: string
    what_to_improve?: string
    would_recommend: boolean
    recommendation_score: number
  }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const {
    enrollment_id, overall_progress, visible_changes, goal_still_relevant,
    wants_intensity_change, would_recommend, recommendation_score,
  } = body

  if (!enrollment_id || overall_progress == null || visible_changes == null ||
      goal_still_relevant == null || !wants_intensity_change ||
      would_recommend == null || recommendation_score == null) {
    return NextResponse.json({ error: 'Thiếu trường bắt buộc.' }, { status: 400 })
  }

  if (!Number.isInteger(overall_progress) || overall_progress < 1 || overall_progress > 10) {
    return NextResponse.json({ error: 'overall_progress phải là số nguyên 1–10.' }, { status: 400 })
  }
  if (!Number.isInteger(recommendation_score) || recommendation_score < 0 || recommendation_score > 10) {
    return NextResponse.json({ error: 'recommendation_score phải là số nguyên 0–10.' }, { status: 400 })
  }
  if (!['more_hard', 'keep_same', 'more_light'].includes(wants_intensity_change)) {
    return NextResponse.json({ error: 'wants_intensity_change không hợp lệ.' }, { status: 400 })
  }
  if (!Array.isArray(visible_changes)) {
    return NextResponse.json({ error: 'visible_changes phải là mảng.' }, { status: 400 })
  }

  // ── Verify enrollment + check midpoint window ──────────────────────────────
  const { data: enrollment, error: enrollError } = await supabase
    .from('enrollments')
    .select('id, current_day, programs(duration_days)')
    .eq('id', enrollment_id)
    .eq('user_id', user.id)
    .in('status', ['active', 'completed'])
    .single()

  if (enrollError || !enrollment) {
    return NextResponse.json({ error: 'Enrollment không tồn tại.' }, { status: 404 })
  }

  const programDays = (enrollment.programs as unknown as { duration_days: number }).duration_days
  const halfwayDay = Math.ceil(programDays / 2)
  const currentDay = enrollment.current_day ?? 0

  // Allow submission within a ±window around the midpoint
  const windowStart = halfwayDay - 3
  const windowEnd = halfwayDay + 7

  if (currentDay < windowStart || currentDay > windowEnd) {
    return NextResponse.json({
      error: `Mid-program reflection chỉ có thể submit từ ngày ${windowStart} đến ngày ${windowEnd} (giữa chương trình).`,
      eligible_from: windowStart,
      eligible_until: windowEnd,
      current_day: currentDay,
    }, { status: 400 })
  }

  // ── Check not already submitted ──────────────────────────────────────────
  const { data: existing } = await supabase
    .from('mid_program_reflections')
    .select('id')
    .eq('enrollment_id', enrollment_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Mid-program reflection đã được submit rồi.' }, { status: 409 })
  }

  // ── Get original_goal from profiles ──────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('fitness_goal')
    .eq('id', user.id)
    .single()

  const originalGoal = Array.isArray(profile?.fitness_goal)
    ? (profile.fitness_goal as string[]).join(', ')
    : null

  // ── Insert reflection ──────────────────────────────────────────────────────
  const service = createServiceClient()
  const { data: reflection, error: insertError } = await service
    .from('mid_program_reflections')
    .insert({
      enrollment_id,
      user_id: user.id,
      before_photo_url: body.before_photo_url ?? null,
      midpoint_photo_url: body.midpoint_photo_url ?? null,
      overall_progress,
      visible_changes,
      original_goal: originalGoal,
      goal_still_relevant,
      updated_goal: body.updated_goal ?? null,
      wants_intensity_change,
      what_works_well: body.what_works_well ?? null,
      what_to_improve: body.what_to_improve ?? null,
      would_recommend,
      recommendation_score,
    })
    .select()
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'Mid-program reflection đã được submit rồi.' }, { status: 409 })
    }
    console.error('[reviews/mid-program] POST insert:', insertError)
    return NextResponse.json({ error: 'Không thể lưu reflection.' }, { status: 500 })
  }

  // ── Grant 'halfway' milestone if not yet earned ────────────────────────────
  if (recommendation_score >= 9) {
    const { error: milestoneError } = await service
      .from('completion_milestones')
      .upsert(
        { enrollment_id, user_id: user.id, milestone_type: 'halfway', metadata: { triggered_by: 'mid_program_reflection' } },
        { onConflict: 'enrollment_id,milestone_type', ignoreDuplicates: true }
      )
    if (milestoneError) console.error('[reviews/mid-program] halfway milestone:', milestoneError)
  }

  return NextResponse.json({ reflection })
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  const enrollmentId = request.nextUrl.searchParams.get('enrollment_id')
  if (!enrollmentId) {
    return NextResponse.json({ error: 'Thiếu enrollment_id.' }, { status: 400 })
  }

  const { data: reflection, error } = await supabase
    .from('mid_program_reflections')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[reviews/mid-program] GET:', error)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }

  return NextResponse.json({ reflection })
}
