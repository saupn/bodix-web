import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin/verify-admin'
import { createServiceClient } from '@/lib/supabase/service'
import { autoMatchCohort } from '@/lib/buddy/auto-match'

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

  const service = createServiceClient()

  try {
    const result = await autoMatchCohort(service, body.cohort_id)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[buddy/auto-match]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi khi ghép buddy.' },
      { status: 500 }
    )
  }
}
