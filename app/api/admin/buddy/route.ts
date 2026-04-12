import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin/verify-admin'
import { createServiceClient } from '@/lib/supabase/service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin()
  if ('error' in auth) return auth.error

  const cohortId = request.nextUrl.searchParams.get('cohort_id')

  if (!cohortId || !UUID_RE.test(cohortId)) {
    return NextResponse.json({ error: 'cohort_id không hợp lệ.' }, { status: 400 })
  }

  const service = createServiceClient()

  // Lấy tất cả active pairs trong cohort
  const { data: pairs } = await service
    .from('buddy_pairs')
    .select('id, user_a, user_b, status, matched_by, created_at')
    .eq('cohort_id', cohortId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  // Lấy tất cả enrollments active
  const { data: enrollments } = await service
    .from('enrollments')
    .select('user_id')
    .eq('cohort_id', cohortId)
    .eq('status', 'active')

  const allUserIds = (enrollments ?? []).map(e => e.user_id)

  // Tìm users đã có buddy
  const pairedIds = new Set<string>()
  for (const p of pairs ?? []) {
    pairedIds.add(p.user_a)
    pairedIds.add(p.user_b)
  }

  const unpairedIds = allUserIds.filter(id => !pairedIds.has(id))

  // Lấy profiles cho tất cả users liên quan
  const allIds = [...new Set([...allUserIds, ...pairedIds])]
  const { data: profiles } = await service
    .from('profiles')
    .select('id, full_name')
    .in('id', allIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.full_name]))

  // Format pairs với tên
  const formattedPairs = (pairs ?? []).map(p => ({
    id: p.id,
    user_a: { id: p.user_a, name: profileMap.get(p.user_a) ?? null },
    user_b: { id: p.user_b, name: profileMap.get(p.user_b) ?? null },
    matched_by: p.matched_by,
    created_at: p.created_at,
  }))

  const unpaired = unpairedIds.map(id => ({
    id,
    name: profileMap.get(id) ?? null,
  }))

  return NextResponse.json({
    pairs: formattedPairs,
    unpaired,
    total_members: allUserIds.length,
  })
}
