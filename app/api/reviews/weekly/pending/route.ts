import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWeeklyReviewPending } from '@/lib/reviews/weekly-pending'

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

  try {
    return NextResponse.json(await getWeeklyReviewPending(supabase, enrollment))
  } catch (reviewError) {
    console.error('[reviews/weekly/pending] review query:', reviewError)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }
}
