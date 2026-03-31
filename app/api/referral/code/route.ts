import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizeForCode } from '@/lib/referral/utils'

import { REFERRAL_REWARD_AMOUNT, REFERRAL_DISCOUNT_PERCENT } from '@/lib/affiliate/config'

const DEFAULT_REWARD_VALUE = REFERRAL_REWARD_AMOUNT
const DEFAULT_REFEREE_REWARD_VALUE = REFERRAL_DISCOUNT_PERCENT

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate referral code from full name: bỏ dấu → uppercase → bỏ spaces.
 *  "Nguyễn Lan" → "NGUYENLAN". Trùng → thêm số. */
async function generateCodeFromName(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  fullName: string
): Promise<string | null> {
  const base = normalizeForCode(fullName)
  if (base.length < 3) return null

  // Try base code first
  const candidates = [base]
  for (let i = 1; i <= 9; i++) {
    candidates.push(`${base}${i}`)
  }

  for (const code of candidates) {
    const { data: existing } = await service
      .from('referral_codes')
      .select('id')
      .eq('code', code)
      .maybeSingle()

    if (!existing) {
      // Also check profiles.referral_code
      const { data: profileTaken } = await service
        .from('profiles')
        .select('id')
        .eq('referral_code', code)
        .maybeSingle()

      if (!profileTaken) return code
    }
  }

  // Fallback: base + random 2 digits
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = Math.floor(10 + Math.random() * 90) // 10-99
    const code = `${base}${suffix}`
    const { data: existing } = await service
      .from('referral_codes')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    if (!existing) return code
  }

  return null
}

function validateCustomCode(code: string): string | null {
  if (code.length < 4 || code.length > 20) return 'Code phải từ 4–20 ký tự.'
  if (!/^[A-Za-z0-9-]+$/.test(code)) return 'Code chỉ được chứa chữ cái, số và dấu gạch ngang.'
  return null
}

// ─── GET — Lấy hoặc tự động tạo referral code của user ───────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  // Check existing referral code
  const { data: existing, error: fetchError } = await supabase
    .from('referral_codes')
    .select(`
      id, code, code_type, reward_type, reward_value,
      referee_reward_type, referee_reward_value,
      total_clicks, total_signups, total_conversions, total_revenue_generated,
      is_active, expires_at
    `)
    .eq('user_id', user.id)
    .eq('code_type', 'referral')
    .maybeSingle()

  if (fetchError) {
    console.error('[referral/code] GET fetch:', fetchError)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }

  if (existing) {
    return buildCodeResponse(existing)
  }

  // ── Auto-create referral code from user's name ───────────────────────────
  const service = createServiceClient()

  const { data: profile } = await service
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const fullName = profile?.full_name?.trim() || ''
  const code = await generateCodeFromName(service, fullName)

  if (!code) {
    return NextResponse.json({ error: 'Không thể tạo referral code.' }, { status: 500 })
  }

  const { data: created, error: insertError } = await service
    .from('referral_codes')
    .insert({
      user_id: user.id,
      code,
      code_type: 'referral',
      reward_type: 'credit',
      reward_value: DEFAULT_REWARD_VALUE,
      referee_reward_type: 'discount_percent',
      referee_reward_value: DEFAULT_REFEREE_REWARD_VALUE,
    })
    .select()
    .single()

  if (insertError || !created) {
    console.error('[referral/code] GET create:', insertError)
    return NextResponse.json({ error: 'Không thể tạo referral code.' }, { status: 500 })
  }

  // Also update profile.referral_code
  await service
    .from('profiles')
    .update({ referral_code: code })
    .eq('id', user.id)

  return buildCodeResponse(created, 201)
}

// ─── POST — Tạo custom code (affiliate only) ──────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  let body: { custom_code?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  // ── Verify affiliate approval ─────────────────────────────────────────────
  const { data: affiliate } = await supabase
    .from('affiliate_profiles')
    .select('id, is_approved, commission_rate: id') // just check existence + approval
    .eq('user_id', user.id)
    .eq('is_approved', true)
    .maybeSingle()

  if (!affiliate) {
    return NextResponse.json({ error: 'Chỉ affiliate được duyệt mới có thể tạo custom code.' }, { status: 403 })
  }

  // ── Validate custom code ──────────────────────────────────────────────────
  const rawCode = (body.custom_code ?? '').trim().toUpperCase()
  if (!rawCode) {
    return NextResponse.json({ error: 'Thiếu custom_code.' }, { status: 400 })
  }
  const validationError = validateCustomCode(rawCode)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  // ── Get affiliate commission rate ─────────────────────────────────────────
  const { data: affiliateProfile } = await supabase
    .from('affiliate_profiles')
    .select('affiliate_tier')
    .eq('user_id', user.id)
    .single()

  const { TIER_COMMISSION: TC } = await import('@/lib/affiliate/config')
  const commissionRate = TC[affiliateProfile?.affiliate_tier ?? 'basic'] ?? TC.basic

  // ── Insert affiliate code ─────────────────────────────────────────────────
  const service = createServiceClient()
  const { data: code, error: insertError } = await service
    .from('referral_codes')
    .insert({
      user_id: user.id,
      code: rawCode,
      code_type: 'affiliate',
      reward_type: 'credit',
      reward_value: DEFAULT_REWARD_VALUE,
      referee_reward_type: 'discount_percent',
      referee_reward_value: DEFAULT_REFEREE_REWARD_VALUE,
      commission_rate: commissionRate,
      commission_type: 'percentage',
    })
    .select()
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'Code này đã được sử dụng. Vui lòng chọn code khác.' }, { status: 409 })
    }
    console.error('[referral/code] POST insert:', insertError)
    return NextResponse.json({ error: 'Không thể tạo code.' }, { status: 500 })
  }

  return buildCodeResponse(code, 201)
}

// ─── Response builder ─────────────────────────────────────────────────────────

const REFERRAL_LINK_BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://bodix.fit'

function buildCodeResponse(
  code: {
    id: string
    code: string
    code_type: string
    reward_type: string
    reward_value: number
    referee_reward_type: string
    referee_reward_value: number
    total_clicks: number
    total_signups: number
    total_conversions: number
    total_revenue_generated: number
    is_active: boolean
    expires_at?: string | null
    [key: string]: unknown
  },
  status = 200
) {
  const rewardDesc = code.reward_type === 'credit'
    ? `Voucher ${(code.reward_value / 1000).toFixed(0)}k cho mỗi người đăng ký thành công`
    : `+${code.reward_value}% cho mỗi người chuyển đổi`

  const refereeDesc = code.referee_reward_type === 'discount_percent'
    ? `Giảm ${code.referee_reward_value}% cho người được giới thiệu`
    : `Giảm ${(code.referee_reward_value / 1000).toFixed(0)}k cho người được giới thiệu`

  return NextResponse.json({
    code: code.code,
    code_type: code.code_type,
    referral_link: `${REFERRAL_LINK_BASE}?ref=${code.code}`,
    reward_description: rewardDesc,
    referee_reward_description: refereeDesc,
    is_active: code.is_active,
    expires_at: code.expires_at ?? null,
    stats: {
      clicks: code.total_clicks,
      signups: code.total_signups,
      conversions: code.total_conversions,
      revenue_generated: code.total_revenue_generated,
      earned: code.total_conversions * DEFAULT_REWARD_VALUE,
    },
  }, { status })
}
