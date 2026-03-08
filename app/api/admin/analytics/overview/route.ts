import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin/verify-admin'
import { createServiceClient } from '@/lib/supabase/service'
import { getCachedAnalyticsMVs, getCachedAnalyticsHistorical } from '@/lib/cache'

// KPI targets — per spec
const TARGETS = {
  d7_adherence: 80,
  completion_21: 55,
  referral_share: 10,
  nps: 50,
  upgrade_21_to_6w: 25,
  churn_rate: 8,    // lower is better, target <8%
  visible_change_rate: 70,
}

function trend(current: number | null, previous: number | null): 'up' | 'down' | 'stable' {
  if (current == null || previous == null) return 'stable'
  const delta = current - previous
  if (delta > 1) return 'up'
  if (delta < -1) return 'down'
  return 'stable'
}

function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null
  return Math.round((current - previous) / previous * 1000) / 10
}

function avg(rows: Record<string, unknown>[], key: string): number {
  if (!rows.length) return 0
  return rows.reduce((s, r) => s + ((r[key] as number) ?? 0), 0) / rows.length
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const auth = await verifyAdmin()
  if ('error' in auth) return auth.error

  const service = createServiceClient()
  const todayISO = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

  // Cached MV data (5 min) + cached historical data (1 hour) + live today stats
  const [
    mvData,
    historicalData,
    todayCheckinCount,
    activeCount,
    todayRescueCount,
    todaySignupCount,
    todayPurchaseRows,
    churnRows,
  ] = await Promise.all([
    getCachedAnalyticsMVs(),
    getCachedAnalyticsHistorical(),

    service.from('daily_checkins')
      .select('*', { count: 'exact', head: true })
      .eq('workout_date', todayISO)
      .then(r => r.count ?? 0),

    service.from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .then(r => r.count ?? 0),

    service.from('rescue_interventions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${todayISO}T00:00:00Z`)
      .then(r => r.count ?? 0),

    service.from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${todayISO}T00:00:00Z`)
      .then(r => r.count ?? 0),

    service.from('enrollments')
      .select('amount_paid')
      .gte('paid_at', `${todayISO}T00:00:00Z`)
      .neq('status', 'trial')
      .then(r => (r.data ?? []) as Array<{ amount_paid: number }>),

    service.from('enrollments')
      .select('status')
      .in('status', ['active', 'dropped'])
      .gte('created_at', thirtyDaysAgo)
      .then(r => (r.data ?? []) as Array<{ status: string }>),
  ])

  const { programRows, cohortRows, upgradeRows, revenueRows, monthlyRevenue6 } = mvData
  const {
    completionDailyData,
    dropoutData,
    enrollmentsWithProgram: enrollmentsWithProgramRaw,
    enrollmentStatusRows,
    totalSignupsCount,
  } = historicalData

  // ── D7 adherence from cohorts ──────────────────────────────────────────────
  const d7Adherence = cohortRows.length ? avg(cohortRows, 'd7_adherence') : 0

  // ── Program KPIs ──────────────────────────────────────────────────────────
  const bySlug = Object.fromEntries(programRows.map(p => [p.slug as string, p]))
  const p21 = bySlug['bodix-21'] ?? {}
  const completion21 = (p21.overall_completion_rate as number) ?? 0
  const visibleChange = avg(programRows, 'visible_change_rate')
  const npsVal = avg(programRows, 'nps')

  const upgrades = Object.fromEntries(upgradeRows.map(u => [u.path as string, u]))
  const up21to6w = (upgrades['21_to_6w']?.upgrade_rate as number) ?? 0

  const revThis = (revenueRows[0]?.total_revenue as number) ?? 0
  const revLast = (revenueRows[1]?.total_revenue as number) ?? 0
  const refShare = (revenueRows[0]?.referral_share_percent as number) ?? 0

  const droppedCount = churnRows.filter(e => e.status === 'dropped').length
  const churnRate = churnRows.length ? Math.round(droppedCount / churnRows.length * 1000) / 10 : 0

  const revenueToday = todayPurchaseRows.reduce((s, e) => s + (e.amount_paid ?? 0), 0)
  const checkinRate = (activeCount as number) > 0
    ? Math.round((todayCheckinCount as number) / (activeCount as number) * 1000) / 10
    : 0

  // ── Delta % (use previous month for revenue, placeholder for others) ──────
  const revDelta = deltaPercent(revThis, revLast)

  // ── Chart: Completion daily (30 days) — use last 7 days checkins by program ─
  const checkinsByDay = new Map<string, { '21': number; '6W': number; '12W': number }>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    checkinsByDay.set(key, { '21': 0, '6W': 0, '12W': 0 })
  }
  for (const c of completionDailyData) {
    const slug = (c.enrollments as { programs: { slug: string } | null } | null)?.programs?.slug
    const key = c.workout_date?.slice(0, 10)
    if (!key) continue
    const entry = checkinsByDay.get(key)
    if (entry && slug) {
      if (slug === 'bodix-21') entry['21']++
      else if (slug === 'bodix-6w') entry['6W']++
      else if (slug === 'bodix-12w') entry['12W']++
    }
  }
  const chart_completion_daily = Array.from(checkinsByDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date: date.slice(5), rate_21: v['21'], rate_6w: v['6W'], rate_12w: v['12W'] }))

  // ── Chart: Revenue monthly 6 months, stacked by program + referral line ────
  const enrollmentsWithProgram = enrollmentsWithProgramRaw

  const revByMonthProgram = new Map<string, { bodix21: number; bodix6w: number; bodix12w: number; referral: number }>()
  for (const m of monthlyRevenue6) {
    const monthKey = (m.month as string)?.slice(0, 7) ?? ''
    revByMonthProgram.set(monthKey, { bodix21: 0, bodix6w: 0, bodix12w: 0, referral: 0 })
  }
  for (const e of enrollmentsWithProgram ?? []) {
    const prog = e.programs as { slug: string; name: string }
    const monthKey = (e.paid_at as string)?.slice(0, 7)
    if (!monthKey) continue
    const entry = revByMonthProgram.get(monthKey) ?? { bodix21: 0, bodix6w: 0, bodix12w: 0, referral: 0 }
    const amt = (e.amount_paid as number) ?? 0
    if (prog?.slug === 'bodix-21') entry.bodix21 += amt
    else if (prog?.slug === 'bodix-6w') entry.bodix6w += amt
    else if (prog?.slug === 'bodix-12w') entry.bodix12w += amt
    if (e.referral_code_id) entry.referral += amt
    revByMonthProgram.set(monthKey, entry)
  }
  const chart_revenue_monthly = monthlyRevenue6.map((m) => {
    const monthKey = (m.month as string)?.slice(0, 7) ?? ''
    const entry = revByMonthProgram.get(monthKey) ?? { bodix21: 0, bodix6w: 0, bodix12w: 0, referral: 0 }
    return {
      month: monthKey.slice(5),
      bodix21: entry.bodix21,
      bodix6w: entry.bodix6w,
      bodix12w: entry.bodix12w,
      referral: (m.referral_revenue as number) ?? 0,
      total: (m.total_revenue as number) ?? 0,
    }
  })

  // ── Funnel: Signup → Trial → Purchase → Complete ──────────────────────────
  const statusCounts = enrollmentStatusRows.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1
    return acc
  }, {})
  const totalSignups = totalSignupsCount as number
  const totalTrials = statusCounts['trial'] ?? 0
  const totalPaid = (statusCounts['active'] ?? 0) + (statusCounts['completed'] ?? 0) + (statusCounts['dropped'] ?? 0) + (statusCounts['paused'] ?? 0)
  const totalCompleted = statusCounts['completed'] ?? 0
  const pct = (n: number, d: number) => (d > 0 ? Math.round(n / d * 1000) / 10 : 0)
  const chart_funnel = [
    { step: 'Signup', count: totalSignups, conversion: null as number | null },
    { step: 'Trial', count: totalTrials + totalPaid, conversion: pct(totalTrials + totalPaid, totalSignups) },
    { step: 'Purchase', count: totalPaid, conversion: pct(totalPaid, totalTrials + totalPaid || 1) },
    { step: 'Complete', count: totalCompleted, conversion: pct(totalCompleted, totalPaid || 1) },
  ]

  // ── Dropout heatmap by day ─────────────────────────────────────────────────
  const dropoutByDay = new Map<number, number>()
  for (const d of dropoutData) {
    const day = d.day_number
    dropoutByDay.set(day, (dropoutByDay.get(day) ?? 0) + 1)
  }
  const maxDropout = Math.max(...dropoutByDay.values(), 1)
  const chart_dropout = Array.from({ length: 21 }, (_, i) => i + 1).map((day) => ({
    day,
    count: dropoutByDay.get(day) ?? 0,
    rate: maxDropout > 0 ? Math.round(((dropoutByDay.get(day) ?? 0) / maxDropout) * 100) : 0,
    highlight: day === 3 || day === 7 || day === 14,
  }))

  // ── Alerts ─────────────────────────────────────────────────────────────────
  const alerts: { severity: 'red' | 'yellow' | 'green'; message: string; link?: string }[] = []
  if (d7Adherence < TARGETS.d7_adherence - 10) alerts.push({ severity: 'red', message: 'Cohort D7 adherence thấp', link: '/admin' })
  else if (d7Adherence < TARGETS.d7_adherence) alerts.push({ severity: 'yellow', message: 'D7 adherence cần cải thiện', link: '/admin' })
  if (todayRescueCount > 0 && checkinRate < 50) alerts.push({ severity: 'yellow', message: 'Rescue rate giảm', link: '/admin/nudging' })
  if (npsVal >= TARGETS.nps + 10) alerts.push({ severity: 'green', message: 'NPS tăng', link: '/admin' })
  if (churnRate > TARGETS.churn_rate) alerts.push({ severity: 'red', message: 'Churn rate cao', link: '/admin/nudging' })
  if (completion21 < TARGETS.completion_21 - 15) alerts.push({ severity: 'red', message: 'Completion 21 thấp', link: '/admin' })

  const kpiWithDelta = (actual: number, target: number, prev?: number, invertTrend = false) => ({
    actual: Math.round(actual * 10) / 10,
    target,
    trend: invertTrend ? trend(target, actual) : trend(actual, prev ?? null),
    delta_percent: prev != null ? deltaPercent(actual, prev) : null,
  })

  return NextResponse.json({
    kpis: {
      d7_adherence: kpiWithDelta(d7Adherence, TARGETS.d7_adherence),
      completion_21: kpiWithDelta(completion21, TARGETS.completion_21),
      referral_share: kpiWithDelta(refShare, TARGETS.referral_share),
      nps: kpiWithDelta(npsVal, TARGETS.nps),
      upgrade_21_to_6w: kpiWithDelta(up21to6w, TARGETS.upgrade_21_to_6w),
      churn_rate: { ...kpiWithDelta(churnRate, TARGETS.churn_rate, undefined, true), lower_is_better: true },
      visible_change_rate: kpiWithDelta(visibleChange, TARGETS.visible_change_rate),
      monthly_revenue: {
        actual: revThis,
        target: null,
        trend: trend(revThis, revLast),
        delta_percent: revDelta,
        previous_month: revLast,
      },
    },
    today: {
      checkins: todayCheckinCount,
      rescues: todayRescueCount,
      signups: todaySignupCount,
      purchases: todayPurchaseRows.length,
      revenue: revenueToday,
    },
    charts: {
      completion_daily: chart_completion_daily,
      revenue_monthly: chart_revenue_monthly,
      funnel: chart_funnel,
      dropout: chart_dropout,
    },
    alerts,
    refreshed_at: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=60' },
  })
}
