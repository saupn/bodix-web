import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const MIN_KOL_FOLLOWERS = 1000

interface SocialChannel {
  platform: string
  url: string
  followers: number
}

interface ApplyBody {
  social_channels: SocialChannel[]
  motivation: string
  bank_name?: string
  bank_account_number?: string
  bank_account_name?: string
}

// ─── POST — Đăng ký làm affiliate ────────────────────────────────────────────

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

  const { social_channels, motivation, bank_name, bank_account_number, bank_account_name } = body

  if (!motivation?.trim()) {
    return NextResponse.json({ error: 'Thiếu motivation.' }, { status: 400 })
  }
  if (!Array.isArray(social_channels)) {
    return NextResponse.json({ error: 'social_channels phải là mảng.' }, { status: 400 })
  }

  // ── Check not already applied ─────────────────────────────────────────────
  const { data: existing } = await supabase
    .from('affiliate_profiles')
    .select('id, is_approved')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    if (existing.is_approved) {
      return NextResponse.json({ error: 'Bạn đã là affiliate được duyệt.' }, { status: 409 })
    }
    return NextResponse.json({ status: 'pending_review', message: 'Đơn đăng ký của bạn đang chờ duyệt.' })
  }

  // ── Eligibility: completed program OR KOL (>=1000 followers) ─────────────
  const [completedEnrollmentRes, profileRes] = await Promise.all([
    supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single(),
  ])

  const hasCompletedProgram = !!completedEnrollmentRes.data
  const maxFollowers = social_channels.reduce(
    (max, ch) => Math.max(max, Number(ch.followers) || 0),
    0
  )
  const isKol = maxFollowers >= MIN_KOL_FOLLOWERS

  if (!hasCompletedProgram && !isKol) {
    return NextResponse.json({
      error: `Để đăng ký affiliate, bạn cần hoàn thành ít nhất 1 chương trình BodiX hoặc có tối thiểu ${MIN_KOL_FOLLOWERS.toLocaleString()} followers.`,
      requirements: {
        completed_program: hasCompletedProgram,
        kol_followers: maxFollowers,
        min_kol_followers: MIN_KOL_FOLLOWERS,
      },
    }, { status: 403 })
  }

  // ── Validate social channels ──────────────────────────────────────────────
  const cleanedChannels = social_channels
    .filter(ch => ch.platform && ch.url)
    .slice(0, 10)
    .map(ch => ({
      platform: String(ch.platform).toLowerCase().trim(),
      url: String(ch.url).trim(),
      followers: Math.max(0, Number(ch.followers) || 0),
    }))

  // ── Create affiliate_profiles ─────────────────────────────────────────────
  const service = createServiceClient()
  const { data: affiliate, error: insertError } = await service
    .from('affiliate_profiles')
    .insert({
      user_id: user.id,
      social_channels: cleanedChannels,
      bank_name: bank_name?.trim() ?? null,
      bank_account_number: bank_account_number?.trim() ?? null,
      bank_account_name: bank_account_name?.trim() ?? null,
      is_approved: false,
      affiliate_tier: 'basic',
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ status: 'pending_review', message: 'Đơn đăng ký của bạn đang chờ duyệt.' })
    }
    console.error('[affiliate/apply] insert:', insertError)
    return NextResponse.json({ error: 'Không thể tạo đơn đăng ký.' }, { status: 500 })
  }

  // ── Notify admins ─────────────────────────────────────────────────────────
  const applicantName = profileRes.data?.full_name?.trim() || 'Người dùng'

  // Fetch all admin user IDs
  const { data: admins } = await service
    .from('profiles')
    .select('id')
    .eq('role', 'admin')

  if (admins?.length) {
    const notifications = admins.map(admin => ({
      user_id: admin.id,
      type: 'admin_affiliate_application',
      channel: 'in_app',
      title: `Yêu cầu affiliate mới từ ${applicantName}`,
      content: isKol
        ? `${applicantName} (KOL - ${maxFollowers.toLocaleString()} followers) muốn trở thành affiliate BodiX.`
        : `${applicantName} (Đã hoàn thành chương trình) muốn trở thành affiliate BodiX.`,
      metadata: {
        affiliate_profile_id: affiliate.id,
        applicant_user_id: user.id,
        has_completed_program: hasCompletedProgram,
        max_followers: maxFollowers,
        motivation: motivation.trim().substring(0, 500),
        action_url: '/admin/affiliates',
      },
    }))

    const { error: notifError } = await service.from('notifications').insert(notifications)
    if (notifError) console.error('[affiliate/apply] admin notify:', notifError)
  }

  return NextResponse.json({
    status: 'pending_review',
    message: 'Đơn đăng ký của bạn đã được ghi nhận. Chúng tôi sẽ xem xét và phản hồi trong 1–3 ngày làm việc.',
    affiliate_profile_id: affiliate.id,
  }, { status: 201 })
}
