import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin/verify-admin'
import { createServiceClient } from '@/lib/supabase/service'

// ─── GET ?program_slug=bodix-21 ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin()
  if ('error' in auth) return auth.error

  const service = createServiceClient()
  const programSlug = request.nextUrl.searchParams.get('program_slug')

  let query = service
    .from('mv_cohort_analytics')
    .select(`
      cohort_id, cohort_name, program_slug, program_name, duration_days,
      start_date, end_date, cohort_status, current_members,
      total_enrollments, completed_enrollments, dropped_enrollments,
      completion_rate, d7_adherence, d14_adherence,
      avg_current_streak, max_streak
    `)
    .order('start_date', { ascending: false })

  if (programSlug) {
    query = query.eq('program_slug', programSlug)
  }

  const { data: cohorts, error } = await query

  if (error) {
    console.error('[admin/analytics/cohorts] GET:', error)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }

  return NextResponse.json({ cohorts: cohorts ?? [] }, {
    headers: { 'Cache-Control': 'private, max-age=3600, stale-while-revalidate=300' },
  })
}
