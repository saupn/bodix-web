/**
 * POST /api/checkout/confirm
 *
 * Xác nhận thanh toán thành công và activate enrollment.
 * - Dùng trực tiếp cho mock payment hiện tại
 * - Sau này sẽ được gọi nội bộ bởi webhook handler (không phải client)
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createAffiliateCommission } from '@/lib/affiliate/commission'
import { createReferralCommission } from '@/lib/referral/commission'
import { AFFILIATE_COPY } from '@/lib/copy/affiliate'
import { REFERRAL_COPY } from '@/lib/copy/referral'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── Referral conversion — triggered after successful payment ─────────────────

async function triggerReferralConversion(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  opts: {
    referralCodeId: string
    refereeUserId: string
    programId: string
    enrollmentId: string
    conversionAmount: number   // actual VND paid (after all discounts)
  }
): Promise<void> {
  // ── Fetch code (referrer + config) ────────────────────────────────────────
  const { data: code } = await service
    .from('referral_codes')
    .select('id, user_id, code_type, commission_rate')
    .eq('id', opts.referralCodeId)
    .single()

  if (!code) return

  // ── Find signup tracking record for this user + code ─────────────────────
  const { data: tracking } = await service
    .from('referral_tracking')
    .select('id, status')
    .eq('referral_code_id', opts.referralCodeId)
    .eq('referred_id', opts.refereeUserId)
    .in('status', ['signed_up', 'trial_started', 'clicked'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let trackingId: string

  if (tracking) {
    await service
      .from('referral_tracking')
      .update({
        status: 'converted',
        program_id: opts.programId,
        enrollment_id: opts.enrollmentId,
        conversion_amount: opts.conversionAmount,
        converted_at: new Date().toISOString(),
      })
      .eq('id', tracking.id)
    trackingId = tracking.id
  } else {
    const { data: newTracking, error: createErr } = await service
      .from('referral_tracking')
      .insert({
        referral_code_id: opts.referralCodeId,
        referrer_id: code.user_id,
        referred_id: opts.refereeUserId,
        status: 'converted',
        program_id: opts.programId,
        enrollment_id: opts.enrollmentId,
        conversion_amount: opts.conversionAmount,
        converted_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (createErr || !newTracking) {
      console.error('[checkout/confirm] referral tracking create:', createErr)
      return
    }
    trackingId = newTracking.id
  }

  // ── Update code aggregate stats ───────────────────────────────────────────
  const { data: codeStats } = await service
    .from('referral_codes')
    .select('total_conversions, total_revenue_generated')
    .eq('id', opts.referralCodeId)
    .single()

  if (codeStats) {
    await service
      .from('referral_codes')
      .update({
        total_conversions: codeStats.total_conversions + 1,
        total_revenue_generated: codeStats.total_revenue_generated + opts.conversionAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', opts.referralCodeId)
  }

  const isAffiliate = code.code_type === 'affiliate'

  // ── Tạo commission row (status='pending') cho cả 2 program type ───────────
  // Cả 2 đều dùng V2 cooldown flow: cron rescue-check promote pending → payable
  // khi referee vào cohort + check-in ngày đầu.
  //  - Affiliate: payable = cash hoa hồng (chờ user yêu cầu rút)
  //  - Referral: payable = voucher 100K được issue (cron tạo voucher row,
  //    không tạo trong checkout/confirm để tránh duplicate path).
  if (isAffiliate) {
    await createAffiliateCommission(service, {
      referralCodeId: opts.referralCodeId,
      refereeUserId: opts.refereeUserId,
      enrollmentId: opts.enrollmentId,
      orderId: null,
      conversionAmountVnd: opts.conversionAmount,
    })
  } else {
    await createReferralCommission(service, {
      referralCodeId: opts.referralCodeId,
      refereeUserId: opts.refereeUserId,
      enrollmentId: opts.enrollmentId,
      orderId: null,
      conversionAmountVnd: opts.conversionAmount,
    })
  }

  // ── In-app notification for referrer ─────────────────────────────────────
  const { data: refereeProfile } = await service
    .from('profiles')
    .select('full_name')
    .eq('id', opts.refereeUserId)
    .single()

  const fullName = refereeProfile?.full_name?.trim() ?? ''
  const parts = fullName.split(/\s+/).filter(Boolean)
  const refereeShortName = parts.length >= 2
    ? `${parts[parts.length - 1]} ${parts[0][0].toUpperCase()}.`
    : parts[0] || 'Người bạn'

  const notif = isAffiliate
    ? AFFILIATE_COPY.notifications.inAppOnReferralPurchase(refereeShortName)
    : REFERRAL_COPY.notifications.inAppOnPurchase(refereeShortName)

  await service
    .from('notifications')
    .insert({
      user_id: code.user_id,
      type: 'referral_conversion',
      channel: 'in_app',
      title: notif.title,
      content: notif.body,
      metadata: {
        tracking_id: trackingId,
        action_url: isAffiliate ? '/app/affiliate' : '/app/referral',
      },
    })
    .then(({ error }: { error: unknown }) => {
      if (error) console.error('[checkout/confirm] referral notify:', error)
    })

  // Voucher KHÔNG tạo tại đây — single point of voucher creation là cron
  // rescue-check (lib/referral/commission.ts:issueVoucherForCommission) khi
  // commission được promote pending → payable. Zalo notification về voucher
  // sẽ được gửi tại cron flow đó nếu cần.
}

// ─── Deduct voucher after payment ─────────────────────────────────────────────

async function deductVoucher(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  enrollmentId: string
): Promise<void> {
  const { data: enrollment } = await service
    .from('enrollments')
    .select('voucher_id, voucher_discount_amount')
    .eq('id', enrollmentId)
    .single()

  if (!enrollment?.voucher_id || !enrollment.voucher_discount_amount) return

  const { data: voucher } = await service
    .from('vouchers')
    .select('id, remaining_amount')
    .eq('id', enrollment.voucher_id)
    .single()

  if (!voucher) return

  const newRemaining = Math.max(0, voucher.remaining_amount - enrollment.voucher_discount_amount)
  await service
    .from('vouchers')
    .update({
      remaining_amount: newRemaining,
      status: newRemaining <= 0 ? 'used' : 'active',
      used_at: newRemaining <= 0 ? new Date().toISOString() : null,
    })
    .eq('id', voucher.id)
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // --- Auth ---
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  // --- Parse body ---
  let body: { enrollment_id?: unknown; payment_reference?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (typeof body.enrollment_id !== 'string' || !UUID_RE.test(body.enrollment_id)) {
    return NextResponse.json({ error: 'enrollment_id không hợp lệ.' }, { status: 400 })
  }

  const enrollmentId = body.enrollment_id
  const paymentReference =
    typeof body.payment_reference === 'string' ? body.payment_reference : null

  // --- Lấy enrollment + program + referral info ---
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('enrollments')
    .select(
      `id, user_id, program_id, status, referral_code_id, referral_discount_amount,
       voucher_id, voucher_discount_amount,
       program:programs (id, name, price_vnd, duration_days)`
    )
    .eq('id', enrollmentId)
    .eq('user_id', user.id)
    .single()

  if (enrollmentError || !enrollment) {
    return NextResponse.json({ error: 'Enrollment không tồn tại.' }, { status: 404 })
  }

  if (enrollment.status === 'active') {
    return NextResponse.json(
      { error: 'Enrollment này đã được kích hoạt rồi.' },
      { status: 409 }
    )
  }

  if (enrollment.status !== 'pending_payment') {
    return NextResponse.json(
      { error: `Không thể confirm enrollment ở trạng thái '${enrollment.status}'.` },
      { status: 422 }
    )
  }

  // Import sendViaZalo for Zalo notification
  const { sendViaZalo } = await import('@/lib/messaging/adapters/zalo')

  const program = enrollment.program as unknown as {
    id: string
    name: string
    price_vnd: number
    duration_days: number
  }

  // ── Compute actual amount paid (after all discounts) ──────────────────────
  const referralDiscount = enrollment.referral_discount_amount ?? 0
  const voucherDiscount = enrollment.voucher_discount_amount ?? 0
  const totalDiscount = referralDiscount + voucherDiscount
  const amountPaid = Math.max(0, program.price_vnd - totalDiscount)

  // --- Service client cho các thao tác cần bypass RLS ---
  const service = createServiceClient()
  const now = new Date().toISOString()

  // --- Set enrollment to paid_waiting_cohort (admin sẽ activate cohort sau) ---
  const { data: paidEnrollment, error: updateError } = await service
    .from('enrollments')
    .update({
      status: 'paid_waiting_cohort',
      paid_at: now,
      amount_paid: amountPaid,
      payment_method: 'manual',
      payment_reference: paymentReference,
    })
    .eq('id', enrollmentId)
    .select('id, status, paid_at, cohort_id, amount_paid')
    .single()

  if (updateError || !paidEnrollment) {
    console.error('[checkout/confirm] enrollment update failed:', updateError)
    return NextResponse.json(
      { error: 'Không thể xác nhận thanh toán. Vui lòng liên hệ hỗ trợ.' },
      { status: 500 }
    )
  }

  // --- Deduct voucher balance (non-fatal) ---
  if (enrollment.voucher_id) {
    deductVoucher(service, enrollmentId)
      .catch(err => console.error('[checkout/confirm] voucher deduct:', err))
  }

  // --- In-app notification for buyer ---
  const discountNote = totalDiscount > 0
    ? ` (Đã giảm ${totalDiscount.toLocaleString('vi-VN')}đ)`
    : ''

  await service.from('notifications').insert({
    user_id: user.id,
    type: 'payment_confirmed',
    channel: 'in_app',
    title: `Thanh toán ${program.name} thành công!`,
    content: `Bạn đã thanh toán ${program.name}${discountNote}. Bạn sẽ được thông báo ngày bắt đầu.`,
    metadata: {
      enrollment_id: enrollmentId,
      program_name: program.name,
      amount_paid: amountPaid,
      referral_discount: referralDiscount,
      voucher_discount: voucherDiscount,
    },
    sent_at: now,
  })

  // --- Gửi Zalo xác nhận thanh toán ---
  const { data: profileData } = await service
    .from('profiles')
    .select('channel_user_id')
    .eq('id', user.id)
    .single()

  if (profileData?.channel_user_id) {
    sendViaZalo(
      profileData.channel_user_id,
      '✅ Thanh toán xác nhận! Bạn sẽ được thông báo ngày bắt đầu. Tất cả thành viên sẽ bắt đầu Ngày 1 cùng nhau!'
    ).catch(err => console.error('[checkout/confirm] zalo send:', err))
  }

  // --- Trigger referral conversion reward (non-fatal) ----------------------
  if (enrollment.referral_code_id) {
    triggerReferralConversion(service, {
      referralCodeId: enrollment.referral_code_id,
      refereeUserId: user.id,
      programId: program.id,
      enrollmentId,
      conversionAmount: amountPaid,
    }).catch(err => console.error('[checkout/confirm] referral conversion:', err))
  }

  // --- Update referrals table (personalized referral tracking) -------------
  await service
    .from('referrals')
    .update({ status: 'paid' })
    .eq('referred_id', user.id)
    .eq('status', 'registered')

  return NextResponse.json({
    success: true,
    enrollment: paidEnrollment,
    program: { id: program.id, name: program.name },
    pricing: {
      original_price: program.price_vnd,
      referral_discount: referralDiscount,
      voucher_discount: voucherDiscount,
      amount_paid: amountPaid,
    },
    message: `Thanh toán ${program.name} thành công! Bạn sẽ được thông báo ngày bắt đầu.`,
  })
}
