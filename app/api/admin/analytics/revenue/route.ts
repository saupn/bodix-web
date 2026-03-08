import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin/verify-admin'
import { createServiceClient } from '@/lib/supabase/service'

// ─── GET — Revenue analytics ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin()
  if ('error' in auth) return auth.error

  const service = createServiceClient()
  const months = Math.min(24, Math.max(1, parseInt(request.nextUrl.searchParams.get('months') ?? '12', 10)))

  // ── Materialized view ─────────────────────────────────────────────────────
  const { data: monthlyRows, error: monthlyError } = await service
    .from('mv_monthly_revenue')
    .select('month, total_purchases, total_revenue, avg_order_value, referral_purchases, referral_revenue, referral_share_percent, total_discount_given')
    .order('month', { ascending: false })
    .limit(months)

  if (monthlyError) {
    console.error('[admin/analytics/revenue] monthly:', monthlyError)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }

  const rows = (monthlyRows ?? []).slice().reverse() // chronological order for charts

  // ── Monthly revenue by program (for stacked bar) ─────────────────────────
  const { data: enrollmentsByMonth } = await service
    .from('enrollments')
    .select('paid_at, amount_paid, program_id, referral_code_id, programs!inner(slug, name)')
    .not('paid_at', 'is', null)
    .neq('status', 'trial')

  const byMonthProgram = new Map<string, Record<string, number>>()
  for (const e of enrollmentsByMonth ?? []) {
    const prog = e.programs as { slug: string; name: string }
    const monthKey = (e.paid_at as string)?.slice(0, 7) ?? ''
    if (!monthKey) continue
    const entry = byMonthProgram.get(monthKey) ?? { bodix21: 0, bodix6w: 0, bodix12w: 0, referral: 0 }
    const amt = (e.amount_paid as number) ?? 0
    if (prog?.slug === 'bodix-21') entry.bodix21 += amt
    else if (prog?.slug === 'bodix-6w') entry.bodix6w += amt
    else if (prog?.slug === 'bodix-12w') entry.bodix12w += amt
    if (e.referral_code_id) entry.referral += amt
    byMonthProgram.set(monthKey, entry)
  }

  const monthly_by_program = rows.map((r) => {
    const monthKey = (r.month as string)?.slice(0, 7) ?? ''
    const entry = byMonthProgram.get(monthKey) ?? { bodix21: 0, bodix6w: 0, bodix12w: 0, referral: 0 }
    return {
      month: monthKey,
      month_short: monthKey.slice(5),
      bodix21: entry.bodix21,
      bodix6w: entry.bodix6w,
      bodix12w: entry.bodix12w,
      referral: entry.referral,
      total: (r.total_revenue as number) ?? 0,
    }
  })

  // ── ARR estimate: annualise last 3 months average ─────────────────────────
  const last3 = (monthlyRows ?? []).slice(0, 3)
  const avg3MonthRevenue = last3.length
    ? last3.reduce((s, r) => s + ((r.total_revenue as number) ?? 0), 0) / last3.length
    : 0
  const arr_estimate = Math.round(avg3MonthRevenue * 12)

  // ── MRR (most recent full month) ──────────────────────────────────────────
  const mrr = (monthlyRows?.[0]?.total_revenue as number) ?? 0

  // ── MoM growth ────────────────────────────────────────────────────────────
  const prevMonthRev = (monthlyRows?.[1]?.total_revenue as number) ?? 0
  const mom_growth_percent = prevMonthRev > 0
    ? Math.round((mrr - prevMonthRev) / prevMonthRev * 1000) / 10
    : null

  // ── Revenue by program (live query — not in materialized view) ────────────
  const { data: programRevRows } = await service
    .from('enrollments')
    .select('program_id, amount_paid, programs!enrollments_program_id_fkey(slug, name)')
    .neq('status', 'trial')
    .not('paid_at', 'is', null)

  type ProgramRevMap = { slug: string; name: string; revenue: number; purchases: number }
  const programRevMap = new Map<string, ProgramRevMap>()
  for (const e of programRevRows ?? []) {
    const prog = e.programs as { slug: string; name: string } | null
    if (!prog) continue
    const existing = programRevMap.get(prog.slug) ?? { slug: prog.slug, name: prog.name, revenue: 0, purchases: 0 }
    existing.revenue += (e.amount_paid as number) ?? 0
    existing.purchases++
    programRevMap.set(prog.slug, existing)
  }
  const revenue_by_program = Array.from(programRevMap.values()).sort((a, b) => b.revenue - a.revenue)

  // ── Referral summary (totals) ─────────────────────────────────────────────
  const totalRevenue    = rows.reduce((s, r) => s + ((r.total_revenue    as number) ?? 0), 0)
  const referralRevenue = rows.reduce((s, r) => s + ((r.referral_revenue as number) ?? 0), 0)
  const totalDiscount   = rows.reduce((s, r) => s + ((r.total_discount_given as number) ?? 0), 0)

  return NextResponse.json({
    summary: {
      mrr,
      arr_estimate,
      mom_growth_percent,
      total_revenue_period: totalRevenue,
      referral_revenue_period: referralRevenue,
      referral_share_period: totalRevenue > 0
        ? Math.round(referralRevenue / totalRevenue * 1000) / 10
        : 0,
      total_discount_given: totalDiscount,
    },
    monthly_by_program,
    monthly_chart: rows.map(r => ({
      month: r.month,
      total_purchases:      r.total_purchases,
      total_revenue:        r.total_revenue,
      avg_order_value:      r.avg_order_value,
      referral_purchases:   r.referral_purchases,
      referral_revenue:     r.referral_revenue,
      referral_share_percent: r.referral_share_percent,
      total_discount_given: r.total_discount_given,
    })),
    revenue_by_program,
  }, {
    headers: { 'Cache-Control': 'private, max-age=3600, stale-while-revalidate=300' },
  })
}
