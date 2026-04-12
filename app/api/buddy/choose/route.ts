import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendViaZalo } from '@/lib/messaging/adapters/zalo'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Số ngày đầu cohort cho phép đổi buddy */
const BUDDY_CHANGE_WINDOW_DAYS = 3

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

  // Lấy cohort start_date để check 3-day window
  const { data: cohort } = await service
    .from('cohorts')
    .select('start_date')
    .eq('id', myEnrollment.cohort_id)
    .single()

  if (cohort?.start_date) {
    const startDate = new Date(cohort.start_date)
    const now = new Date()
    const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

    // Chỉ cho phép đổi buddy nếu chưa có buddy HOẶC trong 3 ngày đầu
    const { data: myExisting } = await service
      .from('buddy_pairs')
      .select('id')
      .eq('cohort_id', myEnrollment.cohort_id)
      .eq('status', 'active')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .maybeSingle()

    if (myExisting && daysSinceStart > BUDDY_CHANGE_WINDOW_DAYS) {
      return NextResponse.json({
        error: `Chỉ được đổi buddy trong ${BUDDY_CHANGE_WINDOW_DAYS} ngày đầu đợt tập.`,
      }, { status: 403 })
    }
  }

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

  // Check buddy đối phương chưa bị paired bởi người khác
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

  // Dissolve pair cũ của mình nếu có (trong window 3 ngày)
  const { data: myOldPair } = await service
    .from('buddy_pairs')
    .select('id, user_a, user_b')
    .eq('cohort_id', myEnrollment.cohort_id)
    .eq('status', 'active')
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .maybeSingle()

  if (myOldPair) {
    await service
      .from('buddy_pairs')
      .update({ status: 'dissolved' })
      .eq('id', myOldPair.id)
  }

  // Tạo pair mới (user_a = người chọn, user_b = người được chọn)
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

  // Gửi Zalo thông báo cho cả 2
  const [{ data: myProfile }, { data: buddyProfile }] = await Promise.all([
    service.from('profiles').select('full_name, channel_user_id').eq('id', user.id).single(),
    service.from('profiles').select('full_name, channel_user_id').eq('id', buddyUserId).single(),
  ])

  const myName = myProfile?.full_name ?? 'Bạn'
  const buddyName = buddyProfile?.full_name ?? 'Bạn'

  const buildMessage = (recipientName: string, partnerName: string) =>
    `🤝 ${recipientName} ơi, bạn đã được ghép đôi với ${partnerName}! ` +
    `Hai bạn sẽ cùng nhau hoàn thành hành trình. Hãy nhắn cho nhau để làm quen nha!`

  const zaloResults = { sent: 0, errors: 0 }

  // Gửi cho buddy
  if (buddyProfile?.channel_user_id) {
    try {
      const r = await sendViaZalo(buddyProfile.channel_user_id, buildMessage(buddyName, myName))
      if (r.success) zaloResults.sent++; else zaloResults.errors++
    } catch { zaloResults.errors++ }
  }

  // Gửi cho mình
  if (myProfile?.channel_user_id) {
    try {
      const r = await sendViaZalo(myProfile.channel_user_id, buildMessage(myName, buddyName))
      if (r.success) zaloResults.sent++; else zaloResults.errors++
    } catch { zaloResults.errors++ }
  }

  return NextResponse.json({ success: true, pair_id: pair.id, zalo: zaloResults })
}
