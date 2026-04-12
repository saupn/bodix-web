import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin/verify-admin'
import { createServiceClient } from '@/lib/supabase/service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin()
  if ('error' in auth) return auth.error

  let body: { pair_id?: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  if (typeof body.pair_id !== 'string' || !UUID_RE.test(body.pair_id)) {
    return NextResponse.json({ error: 'pair_id không hợp lệ.' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: pair } = await service
    .from('buddy_pairs')
    .select('id, status')
    .eq('id', body.pair_id)
    .single()

  if (!pair) {
    return NextResponse.json({ error: 'Pair không tồn tại.' }, { status: 404 })
  }

  if (pair.status === 'dissolved') {
    return NextResponse.json({ error: 'Pair đã được tách rồi.' }, { status: 409 })
  }

  const { error } = await service
    .from('buddy_pairs')
    .update({ status: 'dissolved' })
    .eq('id', body.pair_id)

  if (error) {
    console.error('[admin/buddy/dissolve]', error)
    return NextResponse.json({ error: 'Lỗi khi tách pair.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
