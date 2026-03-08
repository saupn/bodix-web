import { unstable_cache, revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export const CACHE_TAGS = {
  analytics: 'analytics',
  analyticsHistorical: 'analytics-historical',
} as const

/**
 * Cached MV data — 5 min TTL.
 * Materialized views refresh every 2h; caching at 5 min keeps the API fast
 * without serving stale KPIs for too long.
 */
export const getCachedAnalyticsMVs = unstable_cache(
  async () => {
    const service = createServiceClient()
    const [programRows, cohortRows, upgradeRows, revenueRows, monthlyRevenue6] = await Promise.all([
      service
        .from('mv_program_analytics')
        .select('slug, overall_completion_rate, visible_change_rate, nps')
        .then(r => (r.data ?? []) as Record<string, unknown>[]),
      service
        .from('mv_cohort_analytics')
        .select('d7_adherence')
        .then(r => (r.data ?? []) as Record<string, unknown>[]),
      service
        .from('mv_upgrade_funnel')
        .select('path, upgrade_rate')
        .then(r => (r.data ?? []) as Record<string, unknown>[]),
      service
        .from('mv_monthly_revenue')
        .select('month, total_revenue, referral_share_percent, referral_revenue')
        .order('month', { ascending: false })
        .limit(2)
        .then(r => (r.data ?? []) as Record<string, unknown>[]),
      service
        .from('mv_monthly_revenue')
        .select('month, total_revenue, referral_revenue')
        .order('month', { ascending: false })
        .limit(6)
        .then(r => ((r.data ?? []) as Record<string, unknown>[]).reverse()),
    ])
    return { programRows, cohortRows, upgradeRows, revenueRows, monthlyRevenue6 }
  },
  ['admin-analytics-mvs'],
  { revalidate: 300, tags: [CACHE_TAGS.analytics] },
)

/**
 * Cached historical chart data — 1 hour TTL.
 * Enrollment history, check-in trends, dropout patterns. Changes slowly;
 * not worth a DB round-trip on every admin page load.
 */
export const getCachedAnalyticsHistorical = unstable_cache(
  async () => {
    const thirtyDaysAgoDate = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
    const service = createServiceClient()
    const [
      completionDailyData,
      dropoutData,
      enrollmentsWithProgram,
      enrollmentStatusRows,
      totalSignupsCount,
    ] = await Promise.all([
      service
        .from('daily_checkins')
        .select('workout_date, enrollment_id, enrollments!inner(programs(slug))')
        .gte('workout_date', thirtyDaysAgoDate)
        .then(r => (r.data ?? []) as unknown as Array<{
          workout_date: string
          enrollments: { programs: { slug: string } | null } | null
        }>),
      service
        .from('dropout_signals')
        .select('day_number')
        .then(r => (r.data ?? []) as Array<{ day_number: number }>),
      service
        .from('enrollments')
        .select('paid_at, amount_paid, program_id, referral_code_id, programs!inner(slug, name)')
        .not('paid_at', 'is', null)
        .neq('status', 'trial')
        .then(r => r.data ?? []),
      service
        .from('enrollments')
        .select('status')
        .then(r => (r.data ?? []) as Array<{ status: string }>),
      service
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .then(r => r.count ?? 0),
    ])
    return {
      completionDailyData,
      dropoutData,
      enrollmentsWithProgram,
      enrollmentStatusRows,
      totalSignupsCount,
    }
  },
  ['admin-analytics-historical'],
  { revalidate: 3600, tags: [CACHE_TAGS.analyticsHistorical] },
)

/**
 * Call after a user check-in to bump KPI freshness.
 * Usage: import { revalidateAnalytics } from '@/lib/cache'
 *        revalidateAnalytics() at the end of POST /api/checkin
 */
export function revalidateAnalytics() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(revalidateTag as any)(CACHE_TAGS.analytics)
}

/** Call after the analytics MV cron refreshes (every 2h). */
export function revalidateAllAnalytics() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _revalidateTag = revalidateTag as any
  _revalidateTag(CACHE_TAGS.analytics)
  _revalidateTag(CACHE_TAGS.analyticsHistorical)
}
