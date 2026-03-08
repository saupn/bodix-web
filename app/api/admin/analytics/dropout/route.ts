import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin/verify-admin'
import { createServiceClient } from '@/lib/supabase/service'

// ─── GET ?program_slug=bodix-21 ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin()
  if ('error' in auth) return auth.error

  const service = createServiceClient()
  const programSlug = request.nextUrl.searchParams.get('program_slug')

  // ── Resolve program(s) ────────────────────────────────────────────────────
  const programQuery = programSlug
    ? service.from('programs').select('id, slug, name').eq('slug', programSlug).eq('is_active', true)
    : service.from('programs').select('id, slug, name').eq('is_active', true)

  const { data: programs, error: programError } = await programQuery
  if (programError || !programs?.length) {
    return NextResponse.json({ error: 'Không tìm thấy chương trình.' }, { status: 404 })
  }
  const programIds = programs.map(p => p.id)

  // ── Fetch dropout signals + enrollments ───────────────────────────────────
  const [dropoutSignalsRes, enrollmentsRes, rescueRes] = await Promise.all([
    service
      .from('dropout_signals')
      .select('enrollment_id, signal_type, day_number, risk_score, created_at')
      .in('enrollment_id',
        // Sub-select enrollment IDs for these programs
        service
          .from('enrollments')
          .select('id')
          .in('program_id', programIds)
          .then(() => null) as unknown as string[]
      )
      .then(() => null), // placeholder — fetched below

    service
      .from('enrollments')
      .select('id, status, current_day, program_id, started_at')
      .in('program_id', programIds)
      .in('status', ['active', 'dropped', 'paused', 'completed']),

    service
      .from('rescue_interventions')
      .select('enrollment_id, intervention_type, outcome, days_to_return, created_at')
      .in('enrollment_id',
        service
          .from('enrollments')
          .select('id')
          .in('program_id', programIds)
          .then(() => null) as unknown as string[]
      )
      .then(() => null),
  ])

  // Fetch with real enrollment IDs
  const enrollmentIds = (enrollmentsRes.data ?? []).map((e: { id: string }) => e.id)
  const emptyFallback = ['00000000-0000-0000-0000-000000000000']
  const idsOrFallback = enrollmentIds.length ? enrollmentIds : emptyFallback

  const [dropoutSignals, rescueInterventions] = await Promise.all([
    service
      .from('dropout_signals')
      .select('enrollment_id, signal_type, day_number, risk_score, created_at')
      .in('enrollment_id', idsOrFallback)
      .then(r => (r.data ?? []) as Array<{
        enrollment_id: string; signal_type: string
        day_number: number; risk_score: number; created_at: string
      }>),

    service
      .from('rescue_interventions')
      .select('enrollment_id, intervention_type, outcome, days_to_return, created_at')
      .in('enrollment_id', idsOrFallback)
      .then(r => (r.data ?? []) as Array<{
        enrollment_id: string; intervention_type: string
        outcome: string | null; days_to_return: number | null; created_at: string
      }>),
  ])

  const enrollments = (enrollmentsRes.data ?? []) as Array<{
    id: string; status: string; current_day: number; program_id: string; started_at: string | null
  }>

  // ── Dropout hotspots: count dropout signals by day_number ─────────────────
  const hotspotMap = new Map<number, { count: number; signal_types: Record<string, number> }>()
  for (const s of dropoutSignals) {
    const day = s.day_number
    const entry = hotspotMap.get(day) ?? { count: 0, signal_types: {} }
    entry.count++
    entry.signal_types[s.signal_type] = (entry.signal_types[s.signal_type] ?? 0) + 1
    hotspotMap.set(day, entry)
  }

  const dropout_hotspots = Array.from(hotspotMap.entries())
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 15)
    .map(([day, data]) => ({
      day_number: day,
      signal_count: data.count,
      top_signal: Object.entries(data.signal_types).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null,
      signal_breakdown: data.signal_types,
    }))

  // ── Risk distribution (active enrollments only) ───────────────────────────
  const activeEnrollments = enrollments.filter(e => e.status === 'active')
  const riskScoreResults = await Promise.allSettled(
    activeEnrollments.map(e =>
      service
        .rpc('calculate_risk_score', { p_enrollment_id: e.id })
        .then(r => ({ id: e.id, score: (r.data as number) ?? 0 }))
    )
  )

  const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 }
  for (const r of riskScoreResults) {
    if (r.status !== 'fulfilled') continue
    const score = r.value.score
    if (score >= 70)      riskCounts.critical++
    else if (score >= 50) riskCounts.high++
    else if (score >= 30) riskCounts.medium++
    else                  riskCounts.low++
  }

  // ── Rescue effectiveness ──────────────────────────────────────────────────
  const completedRescues    = rescueInterventions.filter(r => r.outcome != null)
  const returnedRescues     = rescueInterventions.filter(r => r.outcome === 'returned')
  const daysToReturnValues  = returnedRescues.map(r => r.days_to_return ?? 0).filter(v => v > 0)

  const rescue_effectiveness = {
    total_interventions: rescueInterventions.length,
    completed_interventions: completedRescues.length,
    returned_count: returnedRescues.length,
    return_rate: completedRescues.length > 0
      ? Math.round(returnedRescues.length / completedRescues.length * 1000) / 10
      : 0,
    avg_days_to_return: daysToReturnValues.length > 0
      ? Math.round(daysToReturnValues.reduce((s, v) => s + v, 0) / daysToReturnValues.length * 10) / 10
      : null,
    by_type: Object.fromEntries(
      ['switch_to_light', 'send_rescue_message', 'pause_program'].map(type => {
        const subset = rescueInterventions.filter(r => r.intervention_type === type)
        const returned = subset.filter(r => r.outcome === 'returned')
        return [type, {
          total: subset.length,
          returned: returned.length,
          return_rate: subset.length > 0
            ? Math.round(returned.length / subset.length * 1000) / 10
            : 0,
        }]
      })
    ),
  }

  // ── Overall dropout summary ───────────────────────────────────────────────
  const droppedCount    = enrollments.filter(e => e.status === 'dropped').length
  const totalEnrollments = enrollments.length
  const dropout_summary = {
    total_enrollments: totalEnrollments,
    dropped: droppedCount,
    dropout_rate: totalEnrollments > 0
      ? Math.round(droppedCount / totalEnrollments * 1000) / 10
      : 0,
    active: activeEnrollments.length,
    completed: enrollments.filter(e => e.status === 'completed').length,
    paused: enrollments.filter(e => e.status === 'paused').length,
  }

  return NextResponse.json({
    programs: programs.map(p => ({ id: p.id, slug: p.slug, name: p.name })),
    dropout_summary,
    dropout_hotspots,
    risk_distribution: riskCounts,
    rescue_effectiveness,
  }, {
    headers: { 'Cache-Control': 'private, max-age=3600, stale-while-revalidate=300' },
  })
}
