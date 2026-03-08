import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin/verify-admin'
import { createServiceClient } from '@/lib/supabase/service'

// ─── GET — Conversion funnel ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin()
  if ('error' in auth) return auth.error

  const service = createServiceClient()
  const month = request.nextUrl.searchParams.get('month') // YYYY-MM for comparison

  const [
    upgradeRows,
    funnelCounts,
    trialConversionRows,
  ] = await Promise.all([
    // Upgrade funnel from materialized view
    service
      .from('mv_upgrade_funnel')
      .select('path, completers, upgraded, upgrade_rate')
      .then(r => (r.data ?? []) as Record<string, unknown>[]),

    // Top-of-funnel: all enrollment statuses
    service
      .from('enrollments')
      .select('status')
      .then(r => (r.data ?? []) as Array<{ status: string }>),

    // Trial → purchase conversion: compare trial vs paid
    service
      .from('enrollments')
      .select('user_id, status, paid_at')
      .in('status', ['active', 'completed', 'dropped', 'paused', 'cancelled', 'trial'])
      .then(r => (r.data ?? []) as Array<{ user_id: string; status: string; paid_at: string | null }>),
  ])

  // ── Signup → trial → purchase → complete counts ───────────────────────────
  let totalSignups: number | null = 0
  let filteredCounts = funnelCounts

  let filteredTrialRows = trialConversionRows
  if (month) {
    const monthStart = `${month}-01T00:00:00Z`
    const d = new Date(month + '-01')
    d.setMonth(d.getMonth() + 1)
    const monthEnd = d.toISOString().slice(0, 10) + 'T00:00:00Z'
    const [signupRes, enrollRes, trialRes] = await Promise.all([
      service.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', monthStart).lt('created_at', monthEnd),
      service.from('enrollments').select('status').gte('created_at', monthStart).lt('created_at', monthEnd),
      service.from('enrollments').select('user_id, status, paid_at').in('status', ['active', 'completed', 'dropped', 'paused', 'cancelled', 'trial']).gte('created_at', monthStart).lt('created_at', monthEnd),
    ])
    totalSignups = signupRes.count ?? 0
    filteredCounts = (enrollRes.data ?? []) as Array<{ status: string }>
    filteredTrialRows = (trialRes.data ?? []) as Array<{ user_id: string; status: string; paid_at: string | null }>
  } else {
    const signupRes = await service.from('profiles').select('*', { count: 'exact', head: true })
    totalSignups = signupRes.count ?? 0
  }

  const statusCounts = filteredCounts.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1
    return acc
  }, {})

  const totalTrials    = statusCounts['trial'] ?? 0
  const totalActive    = (statusCounts['active'] ?? 0) + (statusCounts['completed'] ?? 0) + (statusCounts['dropped'] ?? 0) + (statusCounts['paused'] ?? 0)
  const totalCompleted = statusCounts['completed'] ?? 0
  const totalPaid      = totalActive  // everyone in active/completed/dropped has paid

  // Trial conversion: users who moved from trial to any paid status
  const trialUserIds  = new Set(filteredTrialRows.filter(e => e.status === 'trial').map(e => e.user_id))
  const paidUserIds   = new Set(filteredTrialRows.filter(e => e.paid_at != null).map(e => e.user_id))
  const trialsToPaid  = [...trialUserIds].filter(id => paidUserIds.has(id)).length

  const pct = (n: number, d: number) => d > 0 ? Math.round(n / d * 1000) / 10 : 0

  const funnel_steps = [
    {
      step: 'signup',
      label: 'Đăng ký tài khoản',
      count: totalSignups ?? 0,
      conversion_from_prev: null,
    },
    {
      step: 'trial',
      label: 'Bắt đầu trial',
      count: trialUserIds.size + paidUserIds.size, // all who ever trialed
      conversion_from_prev: pct(trialUserIds.size + paidUserIds.size, totalSignups ?? 1),
    },
    {
      step: 'purchase',
      label: 'Mua chương trình',
      count: totalPaid,
      conversion_from_prev: pct(totalPaid, trialUserIds.size + paidUserIds.size),
    },
    {
      step: 'complete',
      label: 'Hoàn thành chương trình',
      count: totalCompleted,
      conversion_from_prev: pct(totalCompleted, totalPaid),
    },
  ]

  // Trial → paid conversion detail
  const trial_to_paid = {
    users_in_trial: trialUserIds.size,
    users_converted: trialsToPaid,
    conversion_rate: pct(trialsToPaid, trialUserIds.size),
  }

  // Upgrade funnel
  const upgrades = Object.fromEntries(upgradeRows.map(u => [u.path as string, u]))
  const upgrade_funnel = [
    {
      path: '21 → 6W',
      completers:    (upgrades['21_to_6w']?.completers   as number) ?? 0,
      upgraded:      (upgrades['21_to_6w']?.upgraded     as number) ?? 0,
      upgrade_rate:  (upgrades['21_to_6w']?.upgrade_rate as number) ?? 0,
    },
    {
      path: '6W → 12W',
      completers:    (upgrades['6w_to_12w']?.completers   as number) ?? 0,
      upgraded:      (upgrades['6w_to_12w']?.upgraded     as number) ?? 0,
      upgrade_rate:  (upgrades['6w_to_12w']?.upgrade_rate as number) ?? 0,
    },
  ]

  return NextResponse.json({
    funnel_steps,
    trial_to_paid,
    upgrade_funnel,
  }, {
    headers: { 'Cache-Control': 'private, max-age=3600, stale-while-revalidate=300' },
  })
}
