import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const REFERRAL_LINK_BASE = 'https://bodix.vn/ref'
const DEFAULT_REWARD_VALUE = 50000           // 50k credit cho referrer
const DEFAULT_REFEREE_REWARD_VALUE = 10      // giảm 10% cho referee

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I to avoid confusion
  let suffix = ''
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)]
  }
  return `BODIX-${suffix}`
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

  // ── Auto-create referral code ─────────────────────────────────────────────
  const service = createServiceClient()

  // Try up to 5 times to avoid collision (very unlikely with 32^4 = 1M combinations)
  let created = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()
    const { data, error } = await service
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

    if (!error) { created = data; break }
    if (error.code !== '23505') {
      // Not a uniqueness conflict — bail out
      console.error('[referral/code] GET create:', error)
      return NextResponse.json({ error: 'Không thể tạo referral code.' }, { status: 500 })
    }
  }

  if (!created) {
    return NextResponse.json({ error: 'Không thể tạo referral code sau nhiều lần thử.' }, { status: 500 })
  }

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

  const TIER_COMMISSION: Record<string, number> = {
    basic: 10,
    silver: 15,
    gold: 20,
    platinum: 25,
  }
  const commissionRate = TIER_COMMISSION[affiliateProfile?.affiliate_tier ?? 'basic'] ?? 10

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
    ? `+${(code.reward_value / 1000).toFixed(0)}k credit mỗi người chuyển đổi`
    : `+${code.reward_value}% cho mỗi người chuyển đổi`

  const refereeDesc = code.referee_reward_type === 'discount_percent'
    ? `Giảm ${code.referee_reward_value}% cho người được giới thiệu`
    : `Giảm ${(code.referee_reward_value / 1000).toFixed(0)}k cho người được giới thiệu`

  return NextResponse.json({
    code: code.code,
    code_type: code.code_type,
    referral_link: `${REFERRAL_LINK_BASE}/${code.code}`,
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
