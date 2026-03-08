import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const PARTNER_LINK_BASE = 'https://bodix.vn/p'

const TIER_COMMISSION: Record<string, number> = {
  basic: 15,
  silver: 18,
  gold: 20,
  platinum: 25,
}

// ─── GET — Affiliate dashboard ────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  // ── Fetch affiliate profile + user name ─────────────────────────────────────
  const { data: affiliateProfile, error: profileError } = await supabase
    .from('affiliate_profiles')
    .select('id, affiliate_tier, is_approved, total_earned, total_paid, pending_balance, bank_name, bank_account_number, bank_account_name')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: userProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('[affiliate/dashboard] profile:', profileError)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }

  if (!affiliateProfile) {
    return NextResponse.json({ error: 'Bạn chưa đăng ký affiliate.' }, { status: 404 })
  }

  if (!affiliateProfile.is_approved) {
    return NextResponse.json({
      error: 'Tài khoản affiliate của bạn đang chờ duyệt.',
      status: 'pending_review',
      profile: { tier: affiliateProfile.affiliate_tier },
    }, { status: 403 })
  }

  // ── Fetch affiliate code ──────────────────────────────────────────────────
  const { data: affiliateCode } = await supabase
    .from('referral_codes')
    .select(`
      id, code, commission_rate,
      total_clicks, total_signups, total_conversions, total_revenue_generated
    `)
    .eq('user_id', user.id)
    .eq('code_type', 'affiliate')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const commissionRate = affiliateCode?.commission_rate
    ?? TIER_COMMISSION[affiliateProfile.affiliate_tier] ?? 15

  if (!affiliateCode) {
    const emptyStats = buildEmptyStats(affiliateProfile)
    return NextResponse.json({
      profile: {
        tier: affiliateProfile.affiliate_tier,
        is_approved: true,
        commission_rate: commissionRate,
        full_name: userProfile?.full_name?.trim() ?? null,
      },
      code: null,
      stats: { ...emptyStats, this_month_revenue: 0, this_month_commission: 0 },
      recent_conversions: [],
      monthly_chart: buildMonthlyChartForYear([], commissionRate, chartYear),
      bank_info: {
        bank_name: affiliateProfile.bank_name,
        bank_account_number: affiliateProfile.bank_account_number,
        bank_account_name: affiliateProfile.bank_account_name,
      },
      withdrawal_history: [],
    })
  }

  // ── Fetch recent conversions (last 20) ────────────────────────────────────
  const service = createServiceClient()

  const { data: recentTrackings } = await service
    .from('referral_tracking')
    .select(`
      id, referred_id, program_id, conversion_amount, converted_at, status
    `)
    .eq('referral_code_id', affiliateCode.id)
    .eq('status', 'converted')
    .order('converted_at', { ascending: false })
    .limit(20)

  // Collect referred user IDs + program IDs for batch fetch
  const referredIds = [...new Set((recentTrackings ?? [])
    .map(t => t.referred_id)
    .filter(Boolean))] as string[]

  const programIds = [...new Set((recentTrackings ?? [])
    .map(t => t.program_id)
    .filter(Boolean))] as string[]

  const [profilesRes, programsRes] = await Promise.all([
    referredIds.length
      ? service.from('profiles').select('id, full_name').in('id', referredIds)
      : Promise.resolve({ data: [] }),
    programIds.length
      ? service.from('programs').select('id, name').in('id', programIds)
      : Promise.resolve({ data: [] }),
  ])

  const profileMap = new Map<string, string>(
    (profilesRes.data ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? ''])
  )
  const programMap = new Map<string, string>(
    (programsRes.data ?? []).map((p: { id: string; name: string }) => [p.id, p.name])
  )

  const recentConversions = (recentTrackings ?? []).map(t => {
    const fullName = profileMap.get(t.referred_id) ?? ''
    const parts = fullName.trim().split(/\s+/).filter(Boolean)
    const firstName = parts[parts.length - 1] || 'Ẩn danh' // Vietnamese last word = given name

    const commission = Math.round((t.conversion_amount ?? 0) * commissionRate / 100)

    return {
      date: t.converted_at,
      referee_name: firstName,
      program: programMap.get(t.program_id) ?? 'Chương trình BodiX',
      amount: t.conversion_amount ?? 0,
      commission,
      status: 'approved',
    }
  })

  // ── Monthly chart — by year ──────────────────────────────────────────────
  const yearStart = `${chartYear}-01-01T00:00:00Z`
  const yearEnd = `${chartYear}-12-31T23:59:59Z`
  const { data: allConversions } = await service
    .from('referral_tracking')
    .select('conversion_amount, converted_at')
    .eq('referral_code_id', affiliateCode.id)
    .eq('status', 'converted')
    .gte('converted_at', yearStart)
    .lte('converted_at', yearEnd)
    .order('converted_at', { ascending: true })

  const monthlyChart = buildMonthlyChartForYear(allConversions ?? [], commissionRate, chartYear)

  // ── This month stats ─────────────────────────────────────────────────────
  const now = new Date()
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00Z`
  const { data: thisMonthData } = await service
    .from('referral_tracking')
    .select('conversion_amount')
    .eq('referral_code_id', affiliateCode.id)
    .eq('status', 'converted')
    .gte('converted_at', thisMonthStart)
  const thisMonthRevenue = (thisMonthData ?? []).reduce((s, c) => s + (c.conversion_amount ?? 0), 0)
  const thisMonthCommission = Math.round(thisMonthRevenue * commissionRate / 100)

  // ── Withdrawal history ───────────────────────────────────────────────────
  const { data: withdrawals } = await supabase
    .from('user_credits')
    .select('id, amount, balance_after, description, created_at')
    .eq('user_id', user.id)
    .eq('transaction_type', 'withdrawal')
    .order('created_at', { ascending: false })
    .limit(20)

  const withdrawal_history = (withdrawals ?? []).map(w => ({
    id: w.id,
    amount: Math.abs(w.amount),
    created_at: w.created_at,
    description: w.description ?? '',
  }))

  // ── Assemble stats ──────────────────────────────────────────────────────
  const stats = {
    total_clicks: affiliateCode.total_clicks ?? 0,
    total_signups: affiliateCode.total_signups ?? 0,
    total_conversions: affiliateCode.total_conversions ?? 0,
    total_revenue: affiliateCode.total_revenue_generated ?? 0,
    total_earned: affiliateProfile.total_earned ?? 0,
    pending_balance: affiliateProfile.pending_balance ?? 0,
    paid_total: affiliateProfile.total_paid ?? 0,
    this_month_revenue: thisMonthRevenue,
    this_month_commission: thisMonthCommission,
  }

  return NextResponse.json({
    profile: {
      tier: affiliateProfile.affiliate_tier,
      is_approved: true,
      commission_rate: commissionRate,
      full_name: userProfile?.full_name?.trim() ?? null,
    },
    code: {
      code: affiliateCode.code,
      link: `${PARTNER_LINK_BASE}/${affiliateCode.code}`,
    },
    stats,
    recent_conversions: recentConversions,
    monthly_chart: monthlyChart,
    bank_info: {
      bank_name: affiliateProfile.bank_name,
      bank_account_number: affiliateProfile.bank_account_number,
      bank_account_name: affiliateProfile.bank_account_name,
    },
    withdrawal_history,
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildEmptyStats(profile: { total_earned?: number; total_paid?: number; pending_balance?: number }) {
  return {
    total_clicks: 0,
    total_signups: 0,
    total_conversions: 0,
    total_revenue: 0,
    total_earned: profile.total_earned ?? 0,
    pending_balance: profile.pending_balance ?? 0,
    paid_total: profile.total_paid ?? 0,
  }
}

function buildMonthlyChartForYear(
  conversions: Array<{ conversion_amount: number | null; converted_at: string | null }>,
  commissionRate: number,
  year: number
): Array<{ month: string; conversions: number; revenue: number; commission: number }> {
  const map = new Map<string, { conversions: number; revenue: number }>()

  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`
    map.set(key, { conversions: 0, revenue: 0 })
  }

  for (const c of conversions) {
    if (!c.converted_at) continue
    const d = new Date(c.converted_at)
    if (d.getFullYear() !== year) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const entry = map.get(key)
    if (entry) {
      entry.conversions++
      entry.revenue += c.conversion_amount ?? 0
    }
  }

  return Array.from(map.entries()).map(([key, val]) => {
    const [, month] = key.split('-')
    return {
      month: `T${parseInt(month)}/${year}`,
      conversions: val.conversions,
      revenue: val.revenue,
      commission: Math.round(val.revenue * commissionRate / 100),
    }
  })
}
