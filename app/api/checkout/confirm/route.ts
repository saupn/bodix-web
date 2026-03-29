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
import {
  REFERRAL_REWARD_AMOUNT,
  VOUCHER_EXPIRY_MONTHS,
  DEFAULT_COMMISSION_RATE,
} from '@/lib/affiliate/config'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Trả về YYYY-MM-DD của ngày thứ Hai gần nhất (hoặc hôm nay nếu là thứ Hai). */
function nextMonday(from: Date = new Date()): string {
  const d = new Date(from)
  const dow = d.getDay() // 0=Sun, 1=Mon, …, 6=Sat
  const daysUntil = dow === 0 ? 1 : dow === 1 ? 7 : 8 - dow
  d.setDate(d.getDate() + daysUntil)
  return d.toISOString().split('T')[0]
}

/** Cộng thêm N ngày vào date string YYYY-MM-DD. */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

/** Generate random voucher code: V-XXXXX */
function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 for clarity
  let code = 'V-'
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

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

  if (isAffiliate) {
    // ── AFFILIATE: cash commission ──────────────────────────────────────────
    const commissionRate = code.commission_rate ?? DEFAULT_COMMISSION_RATE
    const commission = Math.round(opts.conversionAmount * (commissionRate / 100))

    if (commission > 0) {
      const { data: affiliateProfile } = await service
        .from('affiliate_profiles')
        .select('id, pending_balance, total_earned')
        .eq('user_id', code.user_id)
        .maybeSingle()

      if (affiliateProfile) {
        await service
          .from('affiliate_profiles')
          .update({
            pending_balance: (affiliateProfile.pending_balance ?? 0) + commission,
            total_earned: (affiliateProfile.total_earned ?? 0) + commission,
            updated_at: new Date().toISOString(),
          })
          .eq('id', affiliateProfile.id)
      }

      // Record in referral_rewards
      await service.from('referral_rewards').insert({
        user_id: code.user_id,
        referral_tracking_id: trackingId,
        reward_type: 'commission',
        reward_value: commission,
        reward_description: `Commission ${commissionRate}% × ${(opts.conversionAmount / 1000).toFixed(0)}k = ${(commission / 1000).toFixed(0)}k`,
        status: 'approved',
        approved_at: new Date().toISOString(),
      })
    }
  } else {
    // ── REFERRAL: voucher 100K for referrer ─────────────────────────────────
    const rewardAmount = REFERRAL_REWARD_AMOUNT

    // Generate unique voucher code
    let voucherCode = generateVoucherCode()
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: existing } = await service
        .from('vouchers')
        .select('id')
        .eq('code', voucherCode)
        .maybeSingle()
      if (!existing) break
      voucherCode = generateVoucherCode()
    }

    // Voucher expires in VOUCHER_EXPIRY_MONTHS months
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + VOUCHER_EXPIRY_MONTHS)

    const { data: voucher, error: voucherErr } = await service
      .from('vouchers')
      .insert({
        user_id: code.user_id,
        code: voucherCode,
        amount: rewardAmount,
        remaining_amount: rewardAmount,
        status: 'active',
        expires_at: expiresAt.toISOString(),
        source_type: 'referral_reward',
        source_referral_tracking_id: trackingId,
      })
      .select('id')
      .single()

    if (voucherErr) {
      console.error('[checkout/confirm] voucher create:', voucherErr)
    }

    // Record in referral_rewards
    const { data: reward } = await service
      .from('referral_rewards')
      .insert({
        user_id: code.user_id,
        referral_tracking_id: trackingId,
        reward_type: 'credit',
        reward_value: rewardAmount,
        reward_description: `Voucher ${(rewardAmount / 1000).toFixed(0)}k (${voucherCode})`,
        status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    // Also credit user_credits ledger for tracking
    const { data: currentBalance } = await service.rpc('get_credit_balance', { p_user_id: code.user_id })
    const balanceBefore = (currentBalance as number) ?? 0

    await service.from('user_credits').insert({
      user_id: code.user_id,
      amount: rewardAmount,
      balance_after: balanceBefore + rewardAmount,
      transaction_type: 'referral_reward',
      reference_id: reward?.id ?? voucher?.id ?? null,
      description: `Voucher ${voucherCode}: +${(rewardAmount / 1000).toFixed(0)}k`,
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
  const maskedName = parts.length >= 2
    ? `${parts[parts.length - 1]} ${parts[0][0].toUpperCase()}.`
    : parts[0] || 'Người dùng'

  const notifContent = isAffiliate
    ? `Commission đã được cộng vào tài khoản. Tiếp tục giới thiệu để kiếm thêm!`
    : `Bạn nhận được voucher ${(REFERRAL_REWARD_AMOUNT / 1000).toFixed(0)}k! Dùng khi mua chương trình tiếp theo.`

  await service
    .from('notifications')
    .insert({
      user_id: code.user_id,
      type: 'referral_conversion',
      channel: 'in_app',
      title: `🎉 ${maskedName} đã đăng ký qua link của bạn!`,
      content: notifContent,
      metadata: {
        tracking_id: trackingId,
        reward_amount: REFERRAL_REWARD_AMOUNT,
        action_url: isAffiliate ? '/app/affiliate' : '/app/referral',
      },
    })
    .then(({ error }: { error: unknown }) => {
      if (error) console.error('[checkout/confirm] referral notify:', error)
    })
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

  // --- Tìm cohort phù hợp ---
  const { data: availableCohort } = await service
    .from('cohorts')
    .select('id, name, start_date, end_date, current_members, max_members')
    .eq('program_id', enrollment.program_id)
    .eq('status', 'upcoming')
    .order('start_date', { ascending: true })
    .limit(20)

  const cohortWithSlot =
    (availableCohort ?? []).find((c) => c.current_members < c.max_members) ?? null

  let assignedCohort: {
    id: string
    name: string
    start_date: string
    end_date: string
    current_members: number
  }

  if (cohortWithSlot) {
    const { error: cohortUpdateError } = await service
      .from('cohorts')
      .update({ current_members: cohortWithSlot.current_members + 1 })
      .eq('id', cohortWithSlot.id)

    if (cohortUpdateError) {
      console.error('[checkout/confirm] cohort update failed:', cohortUpdateError)
    }

    assignedCohort = {
      id: cohortWithSlot.id,
      name: cohortWithSlot.name,
      start_date: cohortWithSlot.start_date,
      end_date: cohortWithSlot.end_date,
      current_members: cohortWithSlot.current_members + 1,
    }
  } else {
    const startDate = nextMonday()
    const endDate = addDays(startDate, program.duration_days)
    const d = new Date(startDate)
    const cohortName = `${program.name} - Tháng ${d.getMonth() + 1}/${d.getFullYear()} (Tự đăng ký)`

    const { data: newCohort, error: cohortCreateError } = await service
      .from('cohorts')
      .insert({
        program_id: enrollment.program_id,
        name: cohortName,
        start_date: startDate,
        end_date: endDate,
        max_members: 20,
        current_members: 1,
        status: 'upcoming',
      })
      .select('id, name, start_date, end_date, current_members')
      .single()

    if (cohortCreateError || !newCohort) {
      console.error('[checkout/confirm] cohort create failed:', cohortCreateError)
      return NextResponse.json(
        { error: 'Không thể tạo cohort. Vui lòng liên hệ hỗ trợ.' },
        { status: 500 }
      )
    }

    assignedCohort = newCohort
  }

  // --- Activate enrollment ---
  const { data: activatedEnrollment, error: activateError } = await service
    .from('enrollments')
    .update({
      status: 'active',
      paid_at: now,
      started_at: assignedCohort.start_date,
      cohort_id: assignedCohort.id,
      amount_paid: amountPaid,
      payment_method: 'manual',
      payment_reference: paymentReference,
    })
    .eq('id', enrollmentId)
    .select('id, status, paid_at, started_at, cohort_id, amount_paid')
    .single()

  if (activateError || !activatedEnrollment) {
    console.error('[checkout/confirm] enrollment activate failed:', activateError)
    return NextResponse.json(
      { error: 'Không thể kích hoạt enrollment. Vui lòng liên hệ hỗ trợ.' },
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
    title: `Đăng ký ${program.name} thành công!`,
    content: `Bạn đã đăng ký ${program.name}${discountNote}. Chương trình bắt đầu ngày ${assignedCohort.start_date}.`,
    metadata: {
      enrollment_id: enrollmentId,
      cohort_id: assignedCohort.id,
      program_name: program.name,
      amount_paid: amountPaid,
      referral_discount: referralDiscount,
      voucher_discount: voucherDiscount,
    },
    sent_at: now,
  })

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
    enrollment: activatedEnrollment,
    cohort: assignedCohort,
    program: { id: program.id, name: program.name },
    pricing: {
      original_price: program.price_vnd,
      referral_discount: referralDiscount,
      voucher_discount: voucherDiscount,
      amount_paid: amountPaid,
    },
    message: `Đăng ký ${program.name} thành công! Chương trình bắt đầu ngày ${assignedCohort.start_date}.`,
  })
}
