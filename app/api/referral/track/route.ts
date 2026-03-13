import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const REFERRAL_COOKIE_TTL_DAYS = 30
import { REFERRAL_REWARD_AMOUNT } from '@/lib/affiliate/config'
const NOTIFICATION_APP_URL = '/app/credits'

// ─── Types ────────────────────────────────────────────────────────────────────

type TrackEvent = 'click' | 'signup' | 'conversion'

interface TrackBody {
  code: string
  event: TrackEvent
  metadata?: {
    source?: string      // 'zalo_share' | 'facebook_share' | 'copy_link' | 'qr_code'
    tracking_id?: string // for signup/conversion: the tracking record from click
    program_id?: string
    enrollment_id?: string
    conversion_amount?: number
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let body: TrackBody
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const { code, event, metadata = {} } = body

  if (!code) return NextResponse.json({ error: 'Thiếu code.' }, { status: 400 })
  if (!['click', 'signup', 'conversion'].includes(event)) {
    return NextResponse.json({ error: 'event không hợp lệ.' }, { status: 400 })
  }

  const service = createServiceClient()

  // ── Resolve referral code ─────────────────────────────────────────────────
  const { data: referralCode, error: codeError } = await service
    .from('referral_codes')
    .select('id, user_id, is_active, max_uses, total_conversions, expires_at, reward_type, reward_value')
    .eq('code', code.trim().toUpperCase())
    .maybeSingle()

  if (codeError || !referralCode) {
    return NextResponse.json({ error: 'Code không tồn tại.' }, { status: 404 })
  }

  if (!referralCode.is_active) {
    return NextResponse.json({ error: 'Code không còn hoạt động.' }, { status: 410 })
  }

  if (referralCode.expires_at && new Date(referralCode.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Code đã hết hạn.' }, { status: 410 })
  }

  // ── Extract request context ───────────────────────────────────────────────
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  const device = request.headers.get('user-agent') ?? 'unknown'
  const source = metadata.source ?? request.nextUrl.searchParams.get('source') ?? 'copy_link'

  // ─────────────────────────────────────────────────────────────────────────
  if (event === 'click') {
    return handleClick({ service, referralCode, ip, device, source })
  }

  if (event === 'signup') {
    if (!user) return NextResponse.json({ error: 'Cần đăng nhập để ghi nhận signup.' }, { status: 401 })
    return handleSignup({ service, referralCode, user, ip, metadata })
  }

  if (event === 'conversion') {
    if (!user) return NextResponse.json({ error: 'Cần đăng nhập để ghi nhận conversion.' }, { status: 401 })
    return handleConversion({ supabase, service, referralCode, user, metadata })
  }

  return NextResponse.json({ error: 'event không hợp lệ.' }, { status: 400 })
}

// ─── Handle: click ────────────────────────────────────────────────────────────

async function handleClick({
  service,
  referralCode,
  ip,
  device,
  source,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any
  referralCode: { id: string; user_id: string }
  ip: string
  device: string
  source: string
}) {
  // Insert tracking record
  const { data: tracking, error: insertError } = await service
    .from('referral_tracking')
    .insert({
      referral_code_id: referralCode.id,
      referrer_id: referralCode.user_id,
      status: 'clicked',
      referral_ip: ip,
      referral_device: device.substring(0, 500),
      referral_source: source,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[referral/track] click insert:', insertError)
    return NextResponse.json({ error: 'Không thể ghi nhận click.' }, { status: 500 })
  }

  // Increment total_clicks (non-fatal if fails)
  await service
    .from('referral_codes')
    .update({ total_clicks: service.rpc }) // use raw increment below
  await service.rpc('increment_referral_clicks', { code_id: referralCode.id }).catch(() => {
    // Fallback: fetch + update
    service
      .from('referral_codes')
      .select('total_clicks')
      .eq('id', referralCode.id)
      .single()
      .then(({ data }: { data: { total_clicks: number } | null }) => {
        if (data) {
          service
            .from('referral_codes')
            .update({ total_clicks: data.total_clicks + 1 })
            .eq('id', referralCode.id)
        }
      })
  })

  // Set referral cookie in response (30 days)
  const cookieMaxAge = REFERRAL_COOKIE_TTL_DAYS * 24 * 60 * 60
  const response = NextResponse.json({ tracking_id: tracking.id })
  response.cookies.set('referral_tracking_id', tracking.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: cookieMaxAge,
    path: '/',
  })
  response.cookies.set('referral_code', referralCode.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: cookieMaxAge,
    path: '/',
  })

  return response
}

// ─── Handle: signup ───────────────────────────────────────────────────────────

async function handleSignup({
  service,
  referralCode,
  user,
  ip,
  metadata,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any
  referralCode: { id: string; user_id: string }
  user: { id: string }
  ip: string
  metadata: TrackBody['metadata']
}) {
  // Self-referral guard
  if (user.id === referralCode.user_id) {
    return NextResponse.json({ error: 'Không thể tự giới thiệu bản thân.' }, { status: 400 })
  }

  // Resolve tracking record: prefer explicit tracking_id, fall back to IP match
  let trackingId = metadata?.tracking_id ?? null

  if (!trackingId) {
    // Find most recent click from same IP for this code
    const { data: byIp } = await service
      .from('referral_tracking')
      .select('id')
      .eq('referral_code_id', referralCode.id)
      .eq('referral_ip', ip)
      .eq('status', 'clicked')
      .is('referred_id', null)
      .order('clicked_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    trackingId = byIp?.id ?? null
  }

  if (!trackingId) {
    // No click record found — create a new tracking row directly at signup stage
    const { data: newTracking, error: createError } = await service
      .from('referral_tracking')
      .insert({
        referral_code_id: referralCode.id,
        referrer_id: referralCode.user_id,
        referred_id: user.id,
        status: 'signed_up',
        signed_up_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (createError) {
      console.error('[referral/track] signup create:', createError)
      return NextResponse.json({ error: 'Không thể ghi nhận signup.' }, { status: 500 })
    }
    trackingId = newTracking.id
  } else {
    // Update existing click record
    const { error: updateError } = await service
      .from('referral_tracking')
      .update({
        referred_id: user.id,
        status: 'signed_up',
        signed_up_at: new Date().toISOString(),
      })
      .eq('id', trackingId)
      .is('referred_id', null)  // guard: don't overwrite if already claimed

    if (updateError) {
      console.error('[referral/track] signup update:', updateError)
      return NextResponse.json({ error: 'Không thể cập nhật tracking.' }, { status: 500 })
    }
  }

  // Increment total_signups
  await incrementCounter(service, referralCode.id, 'total_signups')

  return NextResponse.json({ tracking_id: trackingId, status: 'signed_up' })
}

// ─── Handle: conversion ───────────────────────────────────────────────────────

async function handleConversion({
  supabase,
  service,
  referralCode,
  user,
  metadata,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any
  referralCode: { id: string; user_id: string; reward_type: string; reward_value: number }
  user: { id: string }
  metadata: TrackBody['metadata']
}) {
  if (!metadata?.program_id || !metadata?.enrollment_id || !metadata?.conversion_amount) {
    return NextResponse.json({
      error: 'Thiếu program_id, enrollment_id hoặc conversion_amount.',
    }, { status: 400 })
  }

  // Self-referral guard
  if (user.id === referralCode.user_id) {
    return NextResponse.json({ error: 'Self-referral không hợp lệ.' }, { status: 400 })
  }

  // Find the signup tracking record for this user + code
  const { data: tracking, error: trackingError } = await service
    .from('referral_tracking')
    .select('id, status')
    .eq('referral_code_id', referralCode.id)
    .eq('referred_id', user.id)
    .in('status', ['signed_up', 'trial_started'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (trackingError) {
    console.error('[referral/track] conversion tracking fetch:', trackingError)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }

  if (!tracking) {
    return NextResponse.json({
      error: 'Không tìm thấy tracking record hợp lệ cho conversion này.',
    }, { status: 404 })
  }

  // Check max_uses
  const { data: codeStats } = await service
    .from('referral_codes')
    .select('max_uses, total_conversions')
    .eq('id', referralCode.id)
    .single()

  if (codeStats?.max_uses != null && codeStats.total_conversions >= codeStats.max_uses) {
    return NextResponse.json({ error: 'Code đã đạt giới hạn sử dụng.' }, { status: 410 })
  }

  // ── Update tracking record ────────────────────────────────────────────────
  const { error: updateError } = await service
    .from('referral_tracking')
    .update({
      status: 'converted',
      program_id: metadata.program_id,
      enrollment_id: metadata.enrollment_id,
      conversion_amount: metadata.conversion_amount,
      converted_at: new Date().toISOString(),
    })
    .eq('id', tracking.id)

  if (updateError) {
    console.error('[referral/track] conversion update:', updateError)
    return NextResponse.json({ error: 'Không thể cập nhật tracking.' }, { status: 500 })
  }

  // ── Update code stats ─────────────────────────────────────────────────────
  await Promise.allSettled([
    incrementCounter(service, referralCode.id, 'total_conversions'),
    service
      .from('referral_codes')
      .select('total_revenue_generated')
      .eq('id', referralCode.id)
      .single()
      .then(({ data }: { data: { total_revenue_generated: number } | null }) => {
        if (data) {
          return service
            .from('referral_codes')
            .update({ total_revenue_generated: data.total_revenue_generated + metadata.conversion_amount! })
            .eq('id', referralCode.id)
        }
      }),
  ])

  // ── Create referral reward for referrer ───────────────────────────────────
  const { data: reward, error: rewardError } = await service
    .from('referral_rewards')
    .insert({
      user_id: referralCode.user_id,
      referral_tracking_id: tracking.id,
      reward_type: referralCode.reward_type === 'credit' ? 'credit' : referralCode.reward_type,
      reward_value: referralCode.reward_value,
      reward_description: `Giới thiệu thành công → +${(REFERRAL_REWARD_AMOUNT / 1000).toFixed(0)}k credit`,
      status: 'approved',
      approved_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (rewardError) {
    console.error('[referral/track] reward insert:', rewardError)
    // Non-fatal — tracking updated, reward can be reconciled later
  }

  // ── Credit referrer's wallet ──────────────────────────────────────────────
  if (!rewardError && reward) {
    await creditUser(service, referralCode.user_id, REFERRAL_REWARD_AMOUNT, 'referral_reward', reward.id)
  }

  // ── In-app notification for referrer ─────────────────────────────────────
  const { data: refereeProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const refereeName = maskName(refereeProfile?.full_name ?? '')

  await service
    .from('notifications')
    .insert({
      user_id: referralCode.user_id,
      type: 'referral_conversion',
      channel: 'in_app',
      title: `🎉 ${refereeName} đã đăng ký qua link của bạn!`,
      content: `Bạn nhận được +${(REFERRAL_REWARD_AMOUNT / 1000).toFixed(0)}k credit. Tiếp tục giới thiệu để kiếm thêm!`,
      metadata: {
        tracking_id: tracking.id,
        reward_amount: REFERRAL_REWARD_AMOUNT,
        action_url: NOTIFICATION_APP_URL,
      },
    })
    .then(({ error }: { error: unknown }) => {
      if (error) console.error('[referral/track] notification insert:', error)
    })

  return NextResponse.json({
    status: 'converted',
    tracking_id: tracking.id,
    reward_amount: REFERRAL_REWARD_AMOUNT,
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function incrementCounter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  codeId: string,
  field: 'total_clicks' | 'total_signups' | 'total_conversions'
): Promise<void> {
  const { data } = await service
    .from('referral_codes')
    .select(field)
    .eq('id', codeId)
    .single()
  if (data) {
    await service
      .from('referral_codes')
      .update({ [field]: (data[field] ?? 0) + 1 })
      .eq('id', codeId)
  }
}

async function creditUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  userId: string,
  amount: number,
  transactionType: string,
  referenceId: string
): Promise<void> {
  // Get current balance
  const { data: balanceResult } = await service
    .rpc('get_credit_balance', { p_user_id: userId })

  const currentBalance = (balanceResult as number) ?? 0

  const { error } = await service
    .from('user_credits')
    .insert({
      user_id: userId,
      amount,
      balance_after: currentBalance + amount,
      transaction_type: transactionType,
      reference_id: referenceId,
      description: `Referral reward: +${(amount / 1000).toFixed(0)}k credit`,
    })

  if (error) console.error('[referral/track] creditUser:', error)
}

// "Nguyễn Văn Minh" → "Minh N." — only last word + first initial
function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'Người dùng'
  if (parts.length === 1) return parts[0]
  const lastName = parts[parts.length - 1]
  const firstInitial = parts[0][0].toUpperCase()
  return `${lastName} ${firstInitial}.`
}
