import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type DayStatus = 'completed' | 'missed' | 'upcoming' | 'today' | 'rest_day'

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Return YYYY-MM-DD for startDate + (dayNumber - 1) days, UTC-safe. */
function dayDate(startDate: string, dayNumber: number): string {
  const d = new Date(startDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + dayNumber - 1)
  return d.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // ─── Auth ────────────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  // ─── Query params ─────────────────────────────────────────────────────────────
  const enrollmentId = request.nextUrl.searchParams.get('enrollment_id')
  if (!enrollmentId) {
    return NextResponse.json({ error: 'Thiếu enrollment_id.' }, { status: 400 })
  }

  // ─── Verify enrollment belongs to user ────────────────────────────────────────
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('id, started_at, program_id, programs(duration_days)')
    .eq('id', enrollmentId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (enrollmentError) {
    console.error('[history] enrollment query:', enrollmentError)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }
  if (!enrollment) {
    return NextResponse.json({ error: 'Enrollment không tồn tại.' }, { status: 404 })
  }
  if (!enrollment.started_at) {
    return NextResponse.json({ error: 'Chương trình chưa bắt đầu.' }, { status: 400 })
  }

  const program = enrollment.programs as unknown as { duration_days: number }
  const startDate = enrollment.started_at.slice(0, 10)
  const endDate = dayDate(startDate, program.duration_days)
  const today = todayUTC()

  // ─── Check-ins + workout templates (parallel) ─────────────────────────────────
  const [checkinsResult, templatesResult] = await Promise.all([
    supabase
      .from('daily_checkins')
      .select('day_number, mode, feeling')
      .eq('enrollment_id', enrollmentId),

    supabase
      .from('workout_templates')
      .select('day_number, workout_type')
      .eq('program_id', enrollment.program_id),
  ])

  if (checkinsResult.error) console.error('[history] checkins query:', checkinsResult.error)
  if (templatesResult.error) console.error('[history] templates query:', templatesResult.error)

  // Index check-ins and templates by day_number for O(1) lookup
  const checkinByDay = new Map(
    (checkinsResult.data ?? []).map(c => [c.day_number, c])
  )
  const templateByDay = new Map(
    (templatesResult.data ?? []).map(t => [t.day_number, t.workout_type as string])
  )

  // ─── Build day-by-day calendar ────────────────────────────────────────────────
  const days = Array.from({ length: program.duration_days }, (_, i) => {
    const dayNumber = i + 1
    const date = dayDate(startDate, dayNumber)
    const checkin = checkinByDay.get(dayNumber)
    const workoutType = templateByDay.get(dayNumber) ?? 'main'

    let status: DayStatus
    if (checkin) {
      status = 'completed'
    } else if (date > today) {
      status = 'upcoming'
    } else if (date === today) {
      status = 'today'
    } else {
      // Past day with no check-in
      // 'flexible' days are optional rest days — not penalised as 'missed'
      status = workoutType === 'flexible' ? 'rest_day' : 'missed'
    }

    return {
      day_number: dayNumber,
      date,
      status,
      mode: checkin?.mode ?? null,
      feeling: checkin?.feeling ?? null,
    }
  })

  return NextResponse.json({
    enrollment_id: enrollmentId,
    start_date: startDate,
    end_date: endDate,
    days,
  })
}
