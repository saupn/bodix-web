import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// ─── Internal route — service_role only ──────────────────────────────────────
//
// Called by:
//   - checkout confirmation (after payment) to pre-check before issuing reward
//   - admin dashboard to re-scan existing trackings
//   - cron job for batch fraud scan
//
// Auth: x-internal-secret header (not user JWT)

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? ''

// Fraud thresholds
const MAX_SIGNUPS_PER_IP = 3          // max accounts from same IP
const MAX_SIGNUPS_PER_DEVICE = 3      // max accounts from same device fingerprint
const REFUND_WINDOW_HOURS = 48        // conversions reversed within this window are suspicious

// ─── POST — Check a specific tracking record for fraud ────────────────────────

export async function POST(request: NextRequest) {
  // ── Secret gate ──────────────────────────────────────────────────────────
  if (INTERNAL_SECRET) {
    const provided = request.headers.get('x-internal-secret')
    if (provided !== INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
  }

  let body: { tracking_id?: string; scan_all?: boolean; dry_run?: boolean }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const service = createServiceClient()

  if (body.scan_all) {
    return scanAll(service, body.dry_run ?? false)
  }

  if (!body.tracking_id) {
    return NextResponse.json({ error: 'Thiếu tracking_id hoặc scan_all.' }, { status: 400 })
  }

  const result = await checkTracking(service, body.tracking_id, body.dry_run ?? false)
  return NextResponse.json(result)
}

// ─── GET — Check a specific tracking_id (quick lookup for checkout flow) ─────

export async function GET(request: NextRequest) {
  if (INTERNAL_SECRET) {
    const provided = request.headers.get('x-internal-secret')
    if (provided !== INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
  }

  const trackingId = request.nextUrl.searchParams.get('tracking_id')
  if (!trackingId) {
    return NextResponse.json({ error: 'Thiếu tracking_id.' }, { status: 400 })
  }

  const service = createServiceClient()
  const result = await checkTracking(service, trackingId, /* dry_run= */ true)
  return NextResponse.json(result)
}

// ─── Core fraud check for a single tracking record ───────────────────────────

async function checkTracking(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  trackingId: string,
  dryRun: boolean
): Promise<FraudResult> {
  const { data: tracking, error } = await service
    .from('referral_tracking')
    .select('id, referrer_id, referred_id, referral_ip, referral_device, status, converted_at')
    .eq('id', trackingId)
    .single()

  if (error || !tracking) {
    return { tracking_id: trackingId, fraudulent: false, reasons: [], error: 'not_found' }
  }

  if (tracking.status === 'fraudulent') {
    return { tracking_id: trackingId, fraudulent: true, reasons: ['already_flagged'], action: 'none' }
  }

  const reasons: string[] = []

  // ── Rule 1: Self-referral ─────────────────────────────────────────────────
  if (tracking.referred_id && tracking.referrer_id === tracking.referred_id) {
    reasons.push('self_referral')
  }

  // ── Rule 2: Multiple accounts from same IP ────────────────────────────────
  if (tracking.referral_ip && tracking.referral_ip !== 'unknown') {
    const { count: ipCount } = await service
      .from('referral_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('referral_ip', tracking.referral_ip)
      .neq('id', trackingId)
      .in('status', ['signed_up', 'trial_started', 'converted'])

    if ((ipCount ?? 0) >= MAX_SIGNUPS_PER_IP) {
      reasons.push(`ip_abuse:${ipCount}_accounts_from_ip`)
    }
  }

  // ── Rule 3: Multiple accounts from same device ────────────────────────────
  if (tracking.referral_device && tracking.referral_device !== 'unknown') {
    // Match on the first 120 chars of user-agent (enough to fingerprint device/browser)
    const devicePrefix = tracking.referral_device.substring(0, 120)
    const { data: sameDevice } = await service
      .from('referral_tracking')
      .select('id')
      .neq('id', trackingId)
      .in('status', ['signed_up', 'trial_started', 'converted'])
      .like('referral_device', `${devicePrefix}%`)

    if ((sameDevice?.length ?? 0) >= MAX_SIGNUPS_PER_DEVICE) {
      reasons.push(`device_abuse:${sameDevice.length}_accounts_from_device`)
    }
  }

  // ── Rule 4: Referred user has no real activity (ghost account) ────────────
  if (tracking.referred_id) {
    const { data: checkins } = await service
      .from('daily_checkins')
      .select('id')
      .eq('user_id', tracking.referred_id)
      .limit(1)

    const { data: enrollments } = await service
      .from('enrollments')
      .select('id')
      .eq('user_id', tracking.referred_id)
      .limit(1)

    if (!checkins?.length && !enrollments?.length) {
      // Signed up but zero activity — suspicious but not definitive; flag as warning
      reasons.push('ghost_account_no_activity')
    }
  }

  // ── Rule 5: Rapid refund after conversion ─────────────────────────────────
  if (tracking.status === 'converted' && tracking.converted_at) {
    const hoursSinceConversion =
      (Date.now() - new Date(tracking.converted_at).getTime()) / (1000 * 60 * 60)

    if (hoursSinceConversion < REFUND_WINDOW_HOURS) {
      // Check if enrollment is already cancelled/refunded
      const { data: enrollment } = await service
        .from('enrollments')
        .select('status')
        .eq('id', tracking.enrollment_id)
        .maybeSingle()

      if (enrollment?.status === 'cancelled') {
        reasons.push(`rapid_refund:cancelled_within_${Math.round(hoursSinceConversion)}h`)
      }
    }
  }

  // ── Rule 6: Referrer has suspiciously many conversions in short time ───────
  const { count: recentConversions } = await service
    .from('referral_tracking')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_id', tracking.referrer_id)
    .eq('status', 'converted')
    .gte('converted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  if ((recentConversions ?? 0) >= 10) {
    reasons.push(`burst_conversions:${recentConversions}_in_24h`)
  }

  const isFraudulent = reasons.some(r =>
    r.startsWith('self_referral') ||
    r.startsWith('ip_abuse') ||
    r.startsWith('device_abuse') ||
    r.startsWith('rapid_refund') ||
    r.startsWith('burst_conversions')
  )

  // ── Apply if fraudulent and not dry run ───────────────────────────────────
  if (isFraudulent && !dryRun) {
    await applyFraudPenalty(service, trackingId, tracking.referred_id, reasons)
  }

  return {
    tracking_id: trackingId,
    fraudulent: isFraudulent,
    reasons,
    action: isFraudulent ? (dryRun ? 'would_flag' : 'flagged') : 'none',
  }
}

// ─── Apply fraud penalty ──────────────────────────────────────────────────────

async function applyFraudPenalty(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  trackingId: string,
  referredId: string | null,
  reasons: string[]
): Promise<void> {
  // 1. Mark tracking as fraudulent
  const { error: trackingError } = await service
    .from('referral_tracking')
    .update({ status: 'fraudulent' })
    .eq('id', trackingId)

  if (trackingError) {
    console.error('[anti-fraud] flag tracking:', trackingError)
    return
  }

  // 2. Reject any pending/approved rewards linked to this tracking
  const { error: rewardError } = await service
    .from('referral_rewards')
    .update({ status: 'rejected' })
    .eq('referral_tracking_id', trackingId)
    .in('status', ['pending', 'approved'])

  if (rewardError) {
    console.error('[anti-fraud] reject rewards:', rewardError)
  }

  // 3. Reverse any credit already issued (insert negative transaction)
  const { data: credits } = await service
    .from('user_credits')
    .select('id, user_id, amount, balance_after')
    .eq('reference_id', trackingId)
    .eq('transaction_type', 'referral_reward')

  for (const credit of credits ?? []) {
    const { data: currentBalanceResult } = await service
      .rpc('get_credit_balance', { p_user_id: credit.user_id })
    const currentBalance = (currentBalanceResult as number) ?? 0

    await service
      .from('user_credits')
      .insert({
        user_id: credit.user_id,
        amount: -credit.amount,
        balance_after: currentBalance - credit.amount,
        transaction_type: 'admin_adjustment',
        reference_id: trackingId,
        description: `Reversal: fraud detected (${reasons.slice(0, 2).join(', ')})`,
      })
  }

  console.log(`[anti-fraud] flagged tracking ${trackingId}: ${reasons.join(', ')}`)
}

// ─── Batch scan all non-fraudulent converted trackings ────────────────────────

async function scanAll(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  dryRun: boolean
): Promise<NextResponse> {
  const { data: trackings, error } = await service
    .from('referral_tracking')
    .select('id')
    .in('status', ['signed_up', 'trial_started', 'converted'])
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[anti-fraud] scanAll fetch:', error)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }

  const results = await Promise.allSettled(
    (trackings ?? []).map((t: { id: string }) => checkTracking(service, t.id, dryRun))
  )

  let flagged = 0
  let clean = 0
  let errors = 0
  const flaggedIds: string[] = []

  for (const result of results) {
    if (result.status === 'rejected') { errors++; continue }
    if (result.value.fraudulent) {
      flagged++
      flaggedIds.push(result.value.tracking_id)
    } else {
      clean++
    }
  }

  return NextResponse.json({
    scanned: (trackings ?? []).length,
    flagged,
    clean,
    errors,
    dry_run: dryRun,
    flagged_ids: flaggedIds,
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FraudResult {
  tracking_id: string
  fraudulent: boolean
  reasons: string[]
  action?: 'none' | 'flagged' | 'would_flag'
  error?: string
}
