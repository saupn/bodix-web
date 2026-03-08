import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateSuggestion(
  avgFeeling: number | null,
  completionRate: number,
  difficultyRating: number
): { suggestion: string; adjustment: 'increase' | 'maintain' | 'decrease' } {
  // Difficulty overrides feeling-based logic
  if (difficultyRating >= 4) {
    return { suggestion: 'Bài tập đang khá khó. Tuần tới thử Light mode vài buổi để hồi phục nhé 🌿', adjustment: 'decrease' }
  }
  if (difficultyRating <= 2) {
    return { suggestion: 'Bạn đang rất mạnh! Tuần tới challenge bản thân với Hard mode nhé. 💪', adjustment: 'increase' }
  }

  const feeling = avgFeeling ?? 3

  if (feeling >= 4 && completionRate >= 80) {
    return { suggestion: 'Tuần tới thử thêm 1 buổi Hard! Cơ thể bạn đang sẵn sàng. 💪', adjustment: 'increase' }
  }
  if (feeling >= 3 && completionRate >= 60) {
    return { suggestion: 'Đang tốt lắm, giữ nhịp này! ✅', adjustment: 'maintain' }
  }
  return { suggestion: 'Tuần tới chọn Light nhiều hơn, nghỉ ngơi đủ nhé. Consistency quan trọng hơn intensity. 🌿', adjustment: 'decrease' }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  let body: {
    enrollment_id: string
    week_number: number
    fatigue_level: number
    progress_feeling: number
    difficulty_rating: number
    body_changes?: string
    biggest_challenge?: string
    next_week_goal?: string
  }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const { enrollment_id, week_number, fatigue_level, progress_feeling, difficulty_rating } = body

  if (!enrollment_id || !week_number || !fatigue_level || !progress_feeling || !difficulty_rating) {
    return NextResponse.json({ error: 'Thiếu trường bắt buộc.' }, { status: 400 })
  }

  const intFields = { fatigue_level, progress_feeling, difficulty_rating }
  for (const [key, val] of Object.entries(intFields)) {
    if (!Number.isInteger(val) || val < 1 || val > 5) {
      return NextResponse.json({ error: `${key} phải là số nguyên 1–5.` }, { status: 400 })
    }
  }

  // ── Verify enrollment ──────────────────────────────────────────────────────
  const { data: enrollment, error: enrollError } = await supabase
    .from('enrollments')
    .select('id, current_day, program_id, programs(duration_days)')
    .eq('id', enrollment_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (enrollError || !enrollment) {
    return NextResponse.json({ error: 'Enrollment không tồn tại hoặc không active.' }, { status: 404 })
  }

  const programDays = (enrollment.programs as unknown as { duration_days: number }).duration_days
  const maxWeek = Math.ceil(programDays / 7)

  if (!Number.isInteger(week_number) || week_number < 1 || week_number > maxWeek) {
    return NextResponse.json({ error: 'week_number không hợp lệ.' }, { status: 400 })
  }

  // Only allow reviewing weeks that have at least started
  const currentWeek = Math.ceil(enrollment.current_day / 7)
  if (week_number > currentWeek) {
    return NextResponse.json({ error: 'Tuần này chưa bắt đầu.' }, { status: 400 })
  }

  // ── Check not already submitted ──────────────────────────────────────────
  const { data: existing } = await supabase
    .from('weekly_reviews')
    .select('id')
    .eq('enrollment_id', enrollment_id)
    .eq('week_number', week_number)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Tuần này đã submit review rồi.' }, { status: 409 })
  }

  // ── Auto-calculate weekly metrics from daily_checkins ────────────────────
  const weekStartDay = (week_number - 1) * 7 + 1
  const weekEndDay = week_number * 7

  const { data: checkins, error: checkinsError } = await supabase
    .from('daily_checkins')
    .select('mode, feeling')
    .eq('enrollment_id', enrollment_id)
    .gte('day_number', weekStartDay)
    .lte('day_number', weekEndDay)

  if (checkinsError) {
    console.error('[reviews/weekly] POST checkins query:', checkinsError)
    return NextResponse.json({ error: 'Lỗi truy vấn dữ liệu tuần.' }, { status: 500 })
  }

  const weekCheckins = checkins ?? []
  const completedCount = weekCheckins.filter(c => c.mode !== 'skip').length
  const weekCompletionRate = parseFloat(((completedCount / 7) * 100).toFixed(1))

  const hardCount = weekCheckins.filter(c => c.mode === 'hard').length
  const lightCount = weekCheckins.filter(c => c.mode === 'light').length
  const recoveryCount = weekCheckins.filter(c => c.mode === 'recovery').length
  const skipCount = weekCheckins.filter(c => c.mode === 'skip').length

  const feelingsRaw = weekCheckins.map(c => c.feeling).filter((f): f is number => f !== null)
  const avgFeeling = feelingsRaw.length > 0
    ? parseFloat((feelingsRaw.reduce((a, b) => a + b, 0) / feelingsRaw.length).toFixed(1))
    : null

  const { suggestion, adjustment } = generateSuggestion(avgFeeling, weekCompletionRate, difficulty_rating)

  // ── Insert review ────────────────────────────────────────────────────────
  const service = createServiceClient()
  const { data: review, error: insertError } = await service
    .from('weekly_reviews')
    .insert({
      enrollment_id,
      user_id: user.id,
      week_number,
      fatigue_level,
      progress_feeling,
      difficulty_rating,
      body_changes: body.body_changes ?? null,
      biggest_challenge: body.biggest_challenge ?? null,
      next_week_goal: body.next_week_goal ?? null,
      week_completion_rate: weekCompletionRate,
      week_hard_count: hardCount,
      week_light_count: lightCount,
      week_recovery_count: recoveryCount,
      week_skip_count: skipCount,
      avg_feeling: avgFeeling,
      system_suggestion: suggestion,
      intensity_adjustment: adjustment,
    })
    .select()
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'Tuần này đã submit review rồi.' }, { status: 409 })
    }
    console.error('[reviews/weekly] POST insert:', insertError)
    return NextResponse.json({ error: 'Không thể lưu review.' }, { status: 500 })
  }

  return NextResponse.json({
    review,
    system_suggestion: suggestion,
    intensity_adjustment: adjustment,
    week_stats: {
      week_completion_rate: weekCompletionRate,
      hard_count: hardCount,
      light_count: lightCount,
      recovery_count: recoveryCount,
      skip_count: skipCount,
      avg_feeling: avgFeeling,
      total_checkins: weekCheckins.length,
    },
  })
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

  // Verify ownership
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('id', enrollmentId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!enrollment) {
    return NextResponse.json({ error: 'Enrollment không tồn tại.' }, { status: 404 })
  }

  const { data: reviews, error } = await supabase
    .from('weekly_reviews')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('week_number', { ascending: true })

  if (error) {
    console.error('[reviews/weekly] GET:', error)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }

  const data = reviews ?? []

  // Trend arrays (chronological)
  const trend = {
    fatigue_trend: data.map(r => ({ week: r.week_number, value: r.fatigue_level })),
    progress_trend: data.map(r => ({ week: r.week_number, value: r.progress_feeling })),
    difficulty_trend: data.map(r => ({ week: r.week_number, value: r.difficulty_rating })),
    completion_trend: data.map(r => ({ week: r.week_number, value: r.week_completion_rate })),
  }

  return NextResponse.json({ reviews: data, trend })
}
