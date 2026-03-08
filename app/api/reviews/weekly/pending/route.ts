import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  // ── Active enrollment ──────────────────────────────────────────────────────
  const { data: enrollment, error: enrollError } = await supabase
    .from('enrollments')
    .select('id, current_day')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (enrollError) {
    console.error('[reviews/weekly/pending] enrollment query:', enrollError)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }
  if (!enrollment) {
    return NextResponse.json({ pending: false, reason: 'no_active_enrollment' })
  }

  // ── Check if today is Sunday or Monday in ICT (UTC+7) ─────────────────────
  // ICT = UTC + 7h — shift now to ICT to get the correct day-of-week
  const ictNow = new Date(Date.now() + 7 * 60 * 60 * 1000)
  const ictDay = ictNow.getUTCDay() // 0 = Sunday, 1 = Monday

  if (ictDay !== 0 && ictDay !== 1) {
    return NextResponse.json({ pending: false, reason: 'not_review_window' })
  }

  // ── Determine which week to review ────────────────────────────────────────
  // completedWeeks = full weeks where all 7 days have passed relative to current_day
  const completedWeeks = Math.floor(enrollment.current_day / 7)

  if (completedWeeks < 1) {
    return NextResponse.json({ pending: false, reason: 'first_week_not_complete' })
  }

  // ── Check if review for this week is already submitted ────────────────────
  const { data: existing, error: reviewError } = await supabase
    .from('weekly_reviews')
    .select('id, submitted_at')
    .eq('enrollment_id', enrollment.id)
    .eq('week_number', completedWeeks)
    .maybeSingle()

  if (reviewError) {
    console.error('[reviews/weekly/pending] review query:', reviewError)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }

  if (existing) {
    return NextResponse.json({ pending: false, reason: 'already_submitted', week_number: completedWeeks })
  }

  return NextResponse.json({
    pending: true,
    week_number: completedWeeks,
    message: `Tuần ${completedWeeks} vừa kết thúc. Hãy dành 2 phút review nhé!`,
  })
}
