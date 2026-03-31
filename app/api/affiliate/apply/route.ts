import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendViaZalo } from '@/lib/messaging/adapters/zalo'
import { DEFAULT_COMMISSION_RATE, REFERRAL_REWARD_AMOUNT, REFERRAL_DISCOUNT_PERCENT } from '@/lib/affiliate/config'
import { normalizeForCode } from '@/lib/referral/utils'

interface ApplyBody {
  bank_name?: string
  bank_account_number?: string
  bank_account_name?: string
}

// ─── POST — Đăng ký làm affiliate (tự động duyệt) ──────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  let body: ApplyBody
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const { bank_name, bank_account_number, bank_account_name } = body

  // Validate bank info
  if (!bank_name?.trim() || !bank_account_number?.trim() || !bank_account_name?.trim()) {
    return NextResponse.json({ error: 'Vui lòng nhập đầy đủ thông tin ngân hàng.' }, { status: 400 })
  }

  // ── Check not already applied ─────────────────────────────────────────────
  const { data: existing } = await supabase
    .from('affiliate_profiles')
    .select('id, is_approved')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      status: existing.is_approved ? 'approved' : 'approved',
      message: 'Bạn đã là đối tác BodiX.',
    })
  }

  const service = createServiceClient()

  // ── Create affiliate_profiles (auto-approved) ─────────────────────────────
  const now = new Date().toISOString()
  const { data: affiliate, error: insertError } = await service
    .from('affiliate_profiles')
    .insert({
      user_id: user.id,
      bank_name: bank_name.trim(),
      bank_account_number: bank_account_number.trim(),
      bank_account_name: bank_account_name.trim(),
      is_approved: true,
      approved_at: now,
      affiliate_tier: 'basic',
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ status: 'approved', message: 'Bạn đã là đối tác BodiX.' })
    }
    console.error('[affiliate/apply] insert:', insertError)
    return NextResponse.json({ error: 'Không thể tạo đơn đăng ký.' }, { status: 500 })
  }

  // ── Create affiliate referral code (reuse user's existing or generate) ────
  const { data: existingCode } = await service
    .from('referral_codes')
    .select('id, code')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingCode) {
    // Upgrade existing referral code to affiliate
    await service
      .from('referral_codes')
      .update({
        code_type: 'affiliate',
        commission_rate: DEFAULT_COMMISSION_RATE,
        commission_type: 'percentage',
        updated_at: now,
      })
      .eq('id', existingCode.id)
  } else {
    // Generate name-based code
    const { data: profile } = await service
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const base = normalizeForCode(profile?.full_name ?? '')
    let code = base.length >= 3 ? base : `BODIX${Math.floor(1000 + Math.random() * 9000)}`

    // Check uniqueness
    for (let i = 0; i < 10; i++) {
      const candidate = i === 0 ? code : `${code}${i}`
      const { data: taken } = await service
        .from('referral_codes')
        .select('id')
        .eq('code', candidate)
        .maybeSingle()
      if (!taken) {
        code = candidate
        break
      }
    }

    await service.from('referral_codes').insert({
      user_id: user.id,
      code,
      code_type: 'affiliate',
      reward_type: 'credit',
      reward_value: REFERRAL_REWARD_AMOUNT,
      referee_reward_type: 'discount_percent',
      referee_reward_value: REFERRAL_DISCOUNT_PERCENT,
      commission_rate: DEFAULT_COMMISSION_RATE,
      commission_type: 'percentage',
    })

    // Update profile
    await service
      .from('profiles')
      .update({ referral_code: code })
      .eq('id', user.id)
  }

  // ── Gửi Zalo chúc mừng ───────────────────────────────────────────────────
  const { data: profileData } = await service
    .from('profiles')
    .select('channel_user_id, full_name')
    .eq('id', user.id)
    .single()

  if (profileData?.channel_user_id) {
    const name = profileData.full_name?.split(' ').pop() || 'bạn'
    sendViaZalo(
      profileData.channel_user_id,
      `🤝 Chúc mừng ${name}! Bạn là Đối tác BodiX!\n` +
      `Hoa hồng ${DEFAULT_COMMISSION_RATE}% cho mỗi đơn hàng qua link của bạn.\n` +
      `Xem dashboard tại bodix.fit/app/affiliate`
    ).catch(err => console.error('[affiliate/apply] zalo:', err))
  }

  return NextResponse.json({
    status: 'approved',
    message: 'Chúc mừng! Bạn đã trở thành Đối tác BodiX.',
    affiliate_profile_id: affiliate.id,
  }, { status: 201 })
}
