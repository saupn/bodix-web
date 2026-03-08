import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Cache-Control: no-store so UptimeRobot always gets a fresh check
export const dynamic = 'force-dynamic'

export async function GET() {
  const timestamp = new Date().toISOString()

  try {
    const supabase = await createClient()

    // Lightweight ping — count 1 row from programs (always-populated table)
    const { error } = await supabase
      .from('programs')
      .select('id', { count: 'exact', head: true })
      .limit(1)

    if (error) {
      console.error('[health] database check failed:', error.message)
      return NextResponse.json(
        { status: 'error', timestamp, database: 'error', detail: error.message },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    return NextResponse.json(
      { status: 'ok', timestamp, database: 'connected' },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[health] unexpected error:', err)
    return NextResponse.json(
      { status: 'error', timestamp, database: 'error' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
