import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET ?code=BODIX-A7K3 ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Auth optional — unauthenticated users can also validate a code (e.g. on landing page)
  const { data: { user } } = await supabase.auth.getUser()

  const code = request.nextUrl.searchParams.get('code')?.trim().toUpperCase()
  if (!code) {
    return NextResponse.json({ error: 'Thiếu code.' }, { status: 400 })
  }

  // ── Fetch code ────────────────────────────────────────────────────────────
  const { data: referralCode, error } = await supabase
    .from('referral_codes')
    .select('id, user_id, code_type, referee_reward_type, referee_reward_value, is_active, max_uses, total_conversions, expires_at')
    .eq('code', code)
    .maybeSingle()

  if (error) {
    console.error('[referral/validate] GET:', error)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }

  if (!referralCode) {
    return NextResponse.json({ valid: false, reason: 'code_not_found' })
  }

  // ── Validity checks ───────────────────────────────────────────────────────

  if (!referralCode.is_active) {
    return NextResponse.json({ valid: false, reason: 'code_inactive' })
  }

  if (referralCode.expires_at && new Date(referralCode.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, reason: 'code_expired' })
  }

  if (
    referralCode.max_uses != null &&
    referralCode.total_conversions >= referralCode.max_uses
  ) {
    return NextResponse.json({ valid: false, reason: 'code_exhausted' })
  }

  // ── Self-referral guard ───────────────────────────────────────────────────
  if (user && user.id === referralCode.user_id) {
    return NextResponse.json({ valid: false, reason: 'self_referral' })
  }

  // ── Fetch referrer first name only (privacy) ──────────────────────────────
  const { data: referrerProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', referralCode.user_id)
    .single()

  const fullName = referrerProfile?.full_name?.trim() ?? ''
  const firstName = fullName.split(/\s+/)[0] || 'Người dùng'

  // ── Build reward description ──────────────────────────────────────────────
  let rewardDescription = ''
  if (referralCode.referee_reward_type === 'discount_percent') {
    rewardDescription = `Giảm ${referralCode.referee_reward_value}% chương trình đầu tiên`
  } else if (referralCode.referee_reward_type === 'discount_fixed') {
    rewardDescription = `Giảm ${(referralCode.referee_reward_value / 1000).toFixed(0)}k chương trình đầu tiên`
  } else if (referralCode.referee_reward_type === 'free_days') {
    rewardDescription = `Thêm ${referralCode.referee_reward_value} ngày miễn phí`
  } else if (referralCode.referee_reward_type === 'credit') {
    rewardDescription = `+${(referralCode.referee_reward_value / 1000).toFixed(0)}k credit`
  }

  return NextResponse.json({
    valid: true,
    code,
    code_type: referralCode.code_type,
    referrer_name: firstName,  // first name only – no last name, no ID, no email
    reward_description: rewardDescription,
    referee_reward_type: referralCode.referee_reward_type,
    referee_reward_value: referralCode.referee_reward_value,
  })
}
