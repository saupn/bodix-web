import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendViaZalo } from '@/lib/messaging/adapters/zalo'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })

  const service = createServiceClient()

  // Tìm enrollment active
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, cohort_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!enrollment?.cohort_id) {
    return NextResponse.json({ error: 'Không tìm thấy chương trình.' }, { status: 404 })
  }

  // Tìm buddy pair
  const { data: pair } = await service
    .from('buddy_pairs')
    .select('id, user_a, user_b')
    .eq('cohort_id', enrollment.cohort_id)
    .eq('status', 'active')
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .maybeSingle()

  if (!pair) {
    return NextResponse.json({ error: 'Bạn chưa có buddy.' }, { status: 404 })
  }

  const buddyId = pair.user_a === user.id ? pair.user_b : pair.user_a

  // Lấy profile của cả 2
  const [{ data: myProfile }, { data: buddyProfile }] = await Promise.all([
    service.from('profiles').select('full_name').eq('id', user.id).single(),
    service.from('profiles').select('full_name, channel_user_id').eq('id', buddyId).single(),
  ])

  if (!buddyProfile?.channel_user_id) {
    return NextResponse.json({ error: 'Buddy chưa kết nối Zalo.' }, { status: 400 })
  }

  const myName = myProfile?.full_name?.split(' ').pop() || myProfile?.full_name || 'Buddy'
  const buddyName = buddyProfile.full_name?.split(' ').pop() || buddyProfile.full_name || 'bạn'

  const result = await sendViaZalo(
    buddyProfile.channel_user_id,
    `${buddyName} ơi, buddy ${myName} đang chờ! Nhắn 1 để tập nha 💪`
  )

  return NextResponse.json({ success: result.success })
}
