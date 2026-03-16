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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const REFERRAL_REWARD_AMOUNT = 50_000   // credit credited to referrer

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

// ─── Referral conversion — triggered after successful payment ─────────────────

async function triggerReferralConversion(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  opts: {
    referralCodeId: string
    refereeUserId: string
    programId: string
    enrollmentId: string
    conversionAmount: number   // actual VND paid (after discount)
  }
): Promise<void> {
  // ── Fetch code (referrer + reward config) ─────────────────────────────────
  const { data: code } = await service
    .from('referral_codes')
    .select('id, user_id, reward_type, reward_value')
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
    // Update existing record to converted
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
    // No prior click/signup tracked (e.g. deep-link skipped click event) — create directly
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

  // ── Create referral reward for referrer ───────────────────────────────────
  const rewardAmount = code.reward_type === 'credit' ? code.reward_value : REFERRAL_REWARD_AMOUNT
  const { data: reward, error: rewardErr } = await service
    .from('referral_rewards')
    .insert({
      user_id: code.user_id,
      referral_tracking_id: trackingId,
      reward_type: 'credit',
      reward_value: rewardAmount,
      reward_description: `Giới thiệu thành công → +${(rewardAmount / 1000).toFixed(0)}k credit`,
      status: 'approved',
      approved_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (rewardErr) {
    console.error('[checkout/confirm] referral reward insert:', rewardErr)
    return
  }

  // ── Credit referrer wallet ────────────────────────────────────────────────
  const { data: currentBalance } = await service.rpc('get_credit_balance', { p_user_id: code.user_id })
  const balanceBefore = (currentBalance as number) ?? 0

  const { error: creditErr } = await service
    .from('user_credits')
    .insert({
      user_id: code.user_id,
      amount: rewardAmount,
      balance_after: balanceBefore + rewardAmount,
      transaction_type: 'referral_reward',
      reference_id: reward.id,
      description: `Referral reward: +${(rewardAmount / 1000).toFixed(0)}k credit`,
    })

  if (creditErr) {
    console.error('[checkout/confirm] credit user:', creditErr)
  }

  // ── Update affiliate pending_balance if affiliate ─────────────────────────
  const { data: affiliateProfile } = await service
    .from('affiliate_profiles')
    .select('id, pending_balance, total_earned')
    .eq('user_id', code.user_id)
    .maybeSingle()

  if (affiliateProfile) {
    const commissionRate = (await service
      .from('referral_codes')
      .select('commission_rate')
      .eq('id', opts.referralCodeId)
      .single()
    ).data?.commission_rate ?? 0

    const commission = Math.round(opts.conversionAmount * (commissionRate / 100))
    if (commission > 0) {
      await service
        .from('affiliate_profiles')
        .update({
          pending_balance: (affiliateProfile.pending_balance ?? 0) + commission,
          total_earned: (affiliateProfile.total_earned ?? 0) + commission,
          updated_at: new Date().toISOString(),
        })
        .eq('id', affiliateProfile.id)
    }
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

  await service
    .from('notifications')
    .insert({
      user_id: code.user_id,
      type: 'referral_conversion',
      channel: 'in_app',
      title: `🎉 ${maskedName} đã đăng ký qua link của bạn!`,
      content: `Bạn nhận được +${(rewardAmount / 1000).toFixed(0)}k credit. Tiếp tục giới thiệu để kiếm thêm!`,
      metadata: {
        tracking_id: trackingId,
        reward_amount: rewardAmount,
        action_url: '/app/affiliate',
      },
    })
    .then(({ error }: { error: unknown }) => {
      if (error) console.error('[checkout/confirm] referral notify:', error)
    })
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
       program:programs (id, name, price_vnd, duration_days)`
    )
    .eq('id', enrollmentId)
    .eq('user_id', user.id)       // đảm bảo chỉ owner mới confirm được
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

  // ── Compute actual amount paid (after referral discount) ──────────────────
  const discountAmount = enrollment.referral_discount_amount ?? 0
  const amountPaid = Math.max(0, program.price_vnd - discountAmount)

  // --- Service client cho các thao tác cần bypass RLS ---
  const service = createServiceClient()
  const now = new Date().toISOString()

  // --- Tìm cohort phù hợp ---
  // Supabase JS không hỗ trợ column < column filter trực tiếp,
  // nên lấy nhiều cohort rồi filter ở JS.
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
    // Tăng current_members (chấp nhận race condition ở scale nhỏ)
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
    // Không có cohort → tự động tạo cohort mới
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

  // --- In-app notification for buyer ---
  const discountNote = discountAmount > 0
    ? ` (Đã giảm ${discountAmount.toLocaleString('vi-VN')}đ từ referral code)`
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
      discount_amount: discountAmount,
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
      discount_amount: discountAmount,
      amount_paid: amountPaid,
    },
    message: `Đăng ký ${program.name} thành công! Chương trình bắt đầu ngày ${assignedCohort.start_date}.`,
  })
}
