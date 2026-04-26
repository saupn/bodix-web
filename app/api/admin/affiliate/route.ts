import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const REFERRAL_LINK_BASE = 'https://bodix.fit/ref'

import { TIER_COMMISSION } from '@/lib/affiliate/config'

// Commission rate → tier mapping (pick highest matching tier)
function rateToTier(rate: number): string {
  if (rate >= 40) return 'basic'
  if (rate >= 30) return 'silver'
  if (rate >= 25) return 'gold'
  return 'gold'
}

// ─── Admin guard ──────────────────────────────────────────────────────────────

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return data?.role === 'admin'
}

// ─── GET — List affiliate applications ───────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  if (!(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 })
  }

  const params = request.nextUrl.searchParams
  const status = params.get('status') ?? 'pending'   // 'pending' | 'approved' | 'all'
  const page = Math.max(0, parseInt(params.get('page') ?? '0', 10))
  const limit = 20

  const service = createServiceClient()

  // ── Fetch affiliate profiles ──────────────────────────────────────────────
  let query = service
    .from('affiliate_profiles')
    .select('id, user_id, affiliate_tier, social_channels, bank_name, bank_account_number, bank_account_name, total_earned, total_paid, pending_balance, is_approved, approved_at, created_at, full_name, phone, email, partner_type, primary_channel, social_link, estimated_audience, application_note, rejected')
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1)

  if (status === 'pending') {
    query = query.eq('is_approved', false).eq('rejected', false)
  } else if (status === 'approved') {
    query = query.eq('is_approved', true)
  }

  const { data: affiliates, error: fetchError } = await query

  if (fetchError) {
    console.error('[admin/affiliate] GET:', fetchError)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }

  if (!affiliates?.length) {
    return NextResponse.json({ affiliates: [], page, has_more: false })
  }

  // ── Batch-fetch profiles ──────────────────────────────────────────────────
  const userIds = affiliates.map(a => a.user_id).filter(Boolean) as string[]
  const { data: profiles } = userIds.length
    ? await service
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)
    : { data: [] }

  // Fetch notification motivation from admin notification metadata
  const affiliateIds = affiliates.map(a => a.id)
  const { data: notifs } = await service
    .from('notifications')
    .select('metadata')
    .eq('type', 'admin_affiliate_application')
    .in('metadata->>affiliate_profile_id', affiliateIds)

  const motivationMap = new Map<string, string>()
  for (const n of notifs ?? []) {
    const meta = n.metadata as { affiliate_profile_id?: string; motivation?: string } | null
    if (meta?.affiliate_profile_id && meta.motivation) {
      motivationMap.set(meta.affiliate_profile_id, meta.motivation)
    }
  }

  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p])
  )

  // ── Fetch affiliate codes (approved affiliates) ───────────────────────────
  const approvedUserIds = affiliates.filter(a => a.is_approved).map(a => a.user_id)
  const codesMap = new Map<string, { code: string; commission_rate: number; conversions: number; revenue: number; is_active: boolean }>()

  if (approvedUserIds.length) {
    const { data: codes } = await service
      .from('referral_codes')
      .select('user_id, code, commission_rate, total_conversions, total_revenue_generated, is_active')
      .in('user_id', approvedUserIds)
      .eq('code_type', 'affiliate')

    for (const c of codes ?? []) {
      codesMap.set(c.user_id, {
        code: c.code,
        commission_rate: c.commission_rate,
        conversions: c.total_conversions ?? 0,
        revenue: c.total_revenue_generated ?? 0,
        is_active: c.is_active ?? true,
      })
    }
  }

  const rows = affiliates.map(a => {
    const profile = a.user_id ? profileMap.get(a.user_id) as { id: string; full_name: string | null } | undefined : null
    const codeInfo = a.user_id ? codesMap.get(a.user_id) : null
    const maxFollowers = (a.social_channels as SocialChannel[] ?? []).reduce(
      (max: number, ch: SocialChannel) => Math.max(max, ch.followers ?? 0), 0
    )

    return {
      affiliate_id: a.id,
      user_id: a.user_id,
      // Prefer affiliate_profiles.full_name (public registration), fallback to profiles.full_name
      full_name: a.full_name ?? profile?.full_name ?? 'Không có tên',
      affiliate_tier: a.affiliate_tier,
      social_channels: a.social_channels,
      max_followers: maxFollowers,
      bank_name: a.bank_name,
      bank_account_number: a.bank_account_number,
      bank_account_name: a.bank_account_name,
      is_approved: a.is_approved,
      approved_at: a.approved_at,
      applied_at: a.created_at,
      motivation: a.application_note ?? motivationMap.get(a.id) ?? null,
      // New fields from public registration
      phone: a.phone ?? null,
      email: a.email ?? null,
      partner_type: a.partner_type ?? null,
      primary_channel: a.primary_channel ?? null,
      social_link: a.social_link ?? null,
      estimated_audience: a.estimated_audience ?? null,
      stats: {
        total_earned: a.total_earned,
        total_paid: a.total_paid,
        pending_balance: a.pending_balance,
      },
      code: codeInfo
        ? {
            code: codeInfo.code,
            commission_rate: codeInfo.commission_rate,
            link: `${REFERRAL_LINK_BASE}/${codeInfo.code}`,
            conversions: codeInfo.conversions ?? 0,
            revenue: codeInfo.revenue ?? 0,
            is_active: codeInfo.is_active ?? true,
          }
        : null,
    }
  })

  return NextResponse.json({
    affiliates: rows,
    page,
    has_more: affiliates.length === limit,
  })
}

// ─── PUT — Approve or reject affiliate ───────────────────────────────────────

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  if (!(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 })
  }

  let body: { affiliate_id: string; action: 'approve' | 'reject'; commission_rate?: number; reason?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const { affiliate_id, action, commission_rate, reason } = body

  if (!affiliate_id) return NextResponse.json({ error: 'Thiếu affiliate_id.' }, { status: 400 })
  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action phải là "approve" hoặc "reject".' }, { status: 400 })
  }

  const service = createServiceClient()

  // ── Fetch affiliate ───────────────────────────────────────────────────────
  const { data: affiliate, error: fetchError } = await service
    .from('affiliate_profiles')
    .select('id, user_id, is_approved, affiliate_tier')
    .eq('id', affiliate_id)
    .single()

  if (fetchError || !affiliate) {
    return NextResponse.json({ error: 'Affiliate không tồn tại.' }, { status: 404 })
  }

  // ── Reject ────────────────────────────────────────────────────────────────
  if (action === 'reject') {
    if (affiliate.is_approved) {
      return NextResponse.json({ error: 'Không thể từ chối affiliate đã được duyệt.' }, { status: 400 })
    }

    const { error: rejectError } = await service
      .from('affiliate_profiles')
      .update({
        rejected: true,
        rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', affiliate_id)

    if (rejectError) {
      console.error('[admin/affiliate] reject:', rejectError)
      return NextResponse.json({ error: 'Không thể từ chối đơn đăng ký.' }, { status: 500 })
    }

    // Notify the user (only if they have an account)
    if (affiliate.user_id) {
      const rejectContent = reason?.trim()
        ? `Đơn đăng ký affiliate của bạn chưa đáp ứng yêu cầu. Lý do: ${reason.trim()}`
        : 'Đơn đăng ký affiliate của bạn chưa đáp ứng yêu cầu hiện tại. Bạn có thể đăng ký lại sau.'
      await service.from('notifications').insert({
        user_id: affiliate.user_id,
        type: 'affiliate_application_rejected',
        channel: 'in_app',
        title: 'Đơn đăng ký affiliate không được chấp nhận',
        content: rejectContent,
        metadata: { action_url: '/app/profile' },
      })
    }

    return NextResponse.json({ status: 'rejected', affiliate_id })
  }

  // ── Approve ───────────────────────────────────────────────────────────────
  const finalRate = commission_rate ?? TIER_COMMISSION[affiliate.affiliate_tier] ?? TIER_COMMISSION.basic
  if (finalRate < 1 || finalRate > 50) {
    return NextResponse.json({ error: 'commission_rate phải trong khoảng 1–50.' }, { status: 400 })
  }

  const tier = rateToTier(finalRate)

  // 1. Update affiliate profile
  const { error: approveError } = await service
    .from('affiliate_profiles')
    .update({
      is_approved: true,
      approved_at: new Date().toISOString(),
      affiliate_tier: tier,
      updated_at: new Date().toISOString(),
    })
    .eq('id', affiliate_id)

  if (approveError) {
    console.error('[admin/affiliate] approve profile:', approveError)
    return NextResponse.json({ error: 'Không thể duyệt affiliate.' }, { status: 500 })
  }

  // 2. Create affiliate referral code (or update existing)
  const generatedCode = await generateAffiliateCode(service, affiliate.user_id)

  const { data: affiliateCode, error: codeError } = await service
    .from('referral_codes')
    .upsert(
      {
        user_id: affiliate.user_id,
        code: generatedCode,
        code_type: 'affiliate',
        reward_type: 'credit',
        reward_value: 100000,
        referee_reward_type: 'discount_percent',
        referee_reward_value: 10,
        commission_rate: finalRate,
        commission_type: 'percentage',
        is_active: true,
      },
      { onConflict: 'user_id,code_type', ignoreDuplicates: false }
    )
    .select('code')
    .single()

  if (codeError) {
    console.error('[admin/affiliate] create code:', codeError)
    // Non-fatal — profile approved, code can be created later
  }

  // 3. Notify the affiliate
  await service.from('notifications').insert({
    user_id: affiliate.user_id,
    type: 'affiliate_application_approved',
    channel: 'in_app',
    title: '🎉 Chúc mừng! Bạn đã trở thành affiliate BodiX',
    content: `Tài khoản affiliate của bạn đã được duyệt với mức commission ${finalRate}% (tier ${tier}). Truy cập dashboard để lấy link giới thiệu của bạn.`,
    metadata: {
      commission_rate: finalRate,
      tier,
      affiliate_code: affiliateCode?.code ?? null,
      action_url: '/app/affiliate',
    },
  })

  return NextResponse.json({
    status: 'approved',
    affiliate_id,
    tier,
    commission_rate: finalRate,
    code: affiliateCode?.code ?? null,
    referral_link: affiliateCode?.code ? `${REFERRAL_LINK_BASE}/${affiliateCode.code}` : null,
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface SocialChannel {
  platform: string
  url: string
  followers: number
}

async function generateAffiliateCode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  userId: string
): Promise<string> {
  // Check if user already has a code
  const { data: existing } = await service
    .from('referral_codes')
    .select('code')
    .eq('user_id', userId)
    .eq('code_type', 'affiliate')
    .maybeSingle()

  if (existing?.code) return existing.code

  // Generate a new unique code: 'AFF-XXXXXX'
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (let attempt = 0; attempt < 10; attempt++) {
    let suffix = ''
    for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)]
    const candidate = `AFF-${suffix}`

    const { data: conflict } = await service
      .from('referral_codes')
      .select('id')
      .eq('code', candidate)
      .maybeSingle()

    if (!conflict) return candidate
  }

  // Fallback: use part of user ID
  return `AFF-${userId.replace(/-/g, '').toUpperCase().substring(0, 8)}`
}
