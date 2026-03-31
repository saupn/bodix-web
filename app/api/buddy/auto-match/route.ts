import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin/verify-admin'
import { createServiceClient } from '@/lib/supabase/service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin()
  if ('error' in auth) return auth.error

  let body: { cohort_id?: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  if (typeof body.cohort_id !== 'string' || !UUID_RE.test(body.cohort_id)) {
    return NextResponse.json({ error: 'cohort_id không hợp lệ.' }, { status: 400 })
  }

  const cohortId = body.cohort_id
  const service = createServiceClient()

  // Lấy tất cả enrollments active trong cohort
  const { data: enrollments } = await service
    .from('enrollments')
    .select('user_id')
    .eq('cohort_id', cohortId)
    .eq('status', 'active')

  if (!enrollments?.length) {
    return NextResponse.json({ matched: 0, message: 'Không có enrollment active.' })
  }

  const allUserIds = enrollments.map(e => e.user_id)

  // Loại bỏ user đã có buddy
  const { data: existingPairs } = await service
    .from('buddy_pairs')
    .select('user_a, user_b')
    .eq('cohort_id', cohortId)
    .eq('status', 'active')

  const pairedIds = new Set<string>()
  for (const p of existingPairs ?? []) {
    pairedIds.add(p.user_a)
    pairedIds.add(p.user_b)
  }

  const unpairedIds = allUserIds.filter(id => !pairedIds.has(id))

  if (unpairedIds.length < 2) {
    return NextResponse.json({ matched: 0, unpaired: unpairedIds.length, message: 'Không đủ người để ghép.' })
  }

  // Lấy profiles với date_of_birth để sort
  const { data: profiles } = await service
    .from('profiles')
    .select('id, date_of_birth')
    .in('id', unpairedIds)

  // Sort theo date_of_birth (gần tuổi nhau → ghép cùng nhau)
  const sorted = (profiles ?? []).sort((a, b) => {
    const da = a.date_of_birth ?? '1990-01-01'
    const db = b.date_of_birth ?? '1990-01-01'
    return da.localeCompare(db)
  })

  // Ghép theo cặp liền kề
  const pairs: { cohort_id: string; user_a: string; user_b: string; status: string; matched_by: string }[] = []

  for (let i = 0; i + 1 < sorted.length; i += 2) {
    pairs.push({
      cohort_id: cohortId,
      user_a: sorted[i].id,
      user_b: sorted[i + 1].id,
      status: 'active',
      matched_by: 'admin',
    })
  }

  if (pairs.length === 0) {
    return NextResponse.json({ matched: 0, unpaired: sorted.length })
  }

  const { error: insertError } = await service
    .from('buddy_pairs')
    .insert(pairs)

  if (insertError) {
    console.error('[buddy/auto-match] insert:', insertError)
    return NextResponse.json({ error: 'Lỗi khi ghép buddy.', details: insertError.message }, { status: 500 })
  }

  const leftover = sorted.length % 2 === 1 ? 1 : 0

  return NextResponse.json({
    matched: pairs.length,
    unpaired: leftover,
    total_in_cohort: allUserIds.length,
    already_paired: pairedIds.size,
  })
}
