import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''

  // Lấy enrollment active + cohort_id
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, cohort_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!enrollment?.cohort_id) {
    return NextResponse.json({ results: [] })
  }

  const service = createServiceClient()

  // Lấy tất cả user cùng cohort, active
  const { data: cohortEnrollments } = await service
    .from('enrollments')
    .select('user_id')
    .eq('cohort_id', enrollment.cohort_id)
    .eq('status', 'active')
    .neq('user_id', user.id)

  if (!cohortEnrollments?.length) {
    return NextResponse.json({ results: [] })
  }

  const cohortUserIds = cohortEnrollments.map(e => e.user_id)

  // Loại bỏ user đã có buddy trong cohort này
  const { data: existingPairs } = await service
    .from('buddy_pairs')
    .select('user_a, user_b')
    .eq('cohort_id', enrollment.cohort_id)
    .eq('status', 'active')

  const pairedUserIds = new Set<string>()
  for (const p of existingPairs ?? []) {
    pairedUserIds.add(p.user_a)
    pairedUserIds.add(p.user_b)
  }

  const availableIds = cohortUserIds.filter(id => !pairedUserIds.has(id))
  if (availableIds.length === 0) {
    return NextResponse.json({ results: [] })
  }

  // Search by name (hoặc trả tất cả nếu không có query)
  let profileQuery = service
    .from('profiles')
    .select('id, full_name')
    .in('id', availableIds)
    .limit(10)

  if (q.length >= 2) {
    profileQuery = profileQuery.ilike('full_name', `%${q}%`)
  }

  const { data: profiles } = await profileQuery

  return NextResponse.json({
    results: (profiles ?? []).map(p => ({
      id: p.id,
      name: p.full_name,
    })),
  })
}
