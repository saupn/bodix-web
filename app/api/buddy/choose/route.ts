import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })

  let body: { buddy_user_id?: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  if (typeof body.buddy_user_id !== 'string' || !UUID_RE.test(body.buddy_user_id)) {
    return NextResponse.json({ error: 'buddy_user_id không hợp lệ.' }, { status: 400 })
  }

  const buddyUserId = body.buddy_user_id

  if (buddyUserId === user.id) {
    return NextResponse.json({ error: 'Không thể ghép buddy với chính mình.' }, { status: 400 })
  }

  // Lấy enrollment active
  const { data: myEnrollment } = await supabase
    .from('enrollments')
    .select('id, cohort_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!myEnrollment?.cohort_id) {
    return NextResponse.json({ error: 'Bạn chưa tham gia chương trình nào.' }, { status: 403 })
  }

  const service = createServiceClient()

  // Verify buddy cùng cohort + active
  const { data: buddyEnrollment } = await service
    .from('enrollments')
    .select('id')
    .eq('user_id', buddyUserId)
    .eq('cohort_id', myEnrollment.cohort_id)
    .eq('status', 'active')
    .maybeSingle()

  if (!buddyEnrollment) {
    return NextResponse.json({ error: 'Người này không ở cùng đợt tập với bạn.' }, { status: 400 })
  }

  // Check cả 2 chưa paired
  const { data: myExisting } = await service
    .from('buddy_pairs')
    .select('id')
    .eq('cohort_id', myEnrollment.cohort_id)
    .eq('status', 'active')
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .maybeSingle()

  if (myExisting) {
    return NextResponse.json({ error: 'Bạn đã có buddy rồi.' }, { status: 409 })
  }

  const { data: buddyExisting } = await service
    .from('buddy_pairs')
    .select('id')
    .eq('cohort_id', myEnrollment.cohort_id)
    .eq('status', 'active')
    .or(`user_a.eq.${buddyUserId},user_b.eq.${buddyUserId}`)
    .maybeSingle()

  if (buddyExisting) {
    return NextResponse.json({ error: 'Người này đã có buddy rồi.' }, { status: 409 })
  }

  // Tạo pair (user_a = người chọn, user_b = người được chọn)
  const { data: pair, error: insertError } = await service
    .from('buddy_pairs')
    .insert({
      cohort_id: myEnrollment.cohort_id,
      user_a: user.id,
      user_b: buddyUserId,
      status: 'active',
      matched_by: 'manual',
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'Một trong hai đã có buddy.' }, { status: 409 })
    }
    console.error('[buddy/choose] insert:', insertError)
    return NextResponse.json({ error: 'Không thể ghép buddy.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, pair_id: pair.id })
}
