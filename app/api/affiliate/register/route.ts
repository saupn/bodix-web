/**
 * POST /api/affiliate/register
 *
 * Public endpoint — no auth required.
 * Creates an affiliate_profiles record with is_approved = false.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const VALID_PARTNER_TYPES = ['pt', 'kol', 'gym_owner', 'blogger', 'other'] as const
const VALID_CHANNELS = ['zalo', 'facebook', 'instagram', 'tiktok', 'youtube', 'website', 'offline'] as const

export async function POST(request: NextRequest) {
  let body: {
    full_name?: string
    phone?: string
    email?: string
    partner_type?: string
    primary_channel?: string
    social_link?: string
    estimated_audience?: string
    application_note?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  // ── Validation ────────────────────────────────────────────────────────────

  const fullName = body.full_name?.trim()
  if (!fullName || fullName.length < 2) {
    return NextResponse.json({ error: 'Vui lòng nhập họ tên.' }, { status: 400 })
  }

  const phone = body.phone?.trim().replace(/\D/g, '')
  if (!phone || phone.length < 10) {
    return NextResponse.json({ error: 'Vui lòng nhập SĐT hợp lệ.' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Vui lòng nhập email hợp lệ.' }, { status: 400 })
  }

  const partnerType = body.partner_type as string
  if (!partnerType || !VALID_PARTNER_TYPES.includes(partnerType as typeof VALID_PARTNER_TYPES[number])) {
    return NextResponse.json({ error: 'Vui lòng chọn loại đối tác.' }, { status: 400 })
  }

  const primaryChannel = body.primary_channel as string
  if (!primaryChannel || !VALID_CHANNELS.includes(primaryChannel as typeof VALID_CHANNELS[number])) {
    return NextResponse.json({ error: 'Vui lòng chọn kênh quảng bá.' }, { status: 400 })
  }

  const socialLink = body.social_link?.trim() || null
  const estimatedAudience = body.estimated_audience?.trim() || null
  const applicationNote = body.application_note?.trim() || null

  // ── Duplicate check ───────────────────────────────────────────────────────

  const service = createServiceClient()

  const { data: existing } = await service
    .from('affiliate_profiles')
    .select('id, is_approved, rejected')
    .or(`email.eq.${email},phone.eq.${phone}`)
    .limit(1)
    .maybeSingle()

  if (existing) {
    if (existing.is_approved) {
      return NextResponse.json(
        { error: 'Email hoặc SĐT này đã được đăng ký làm đối tác.' },
        { status: 409 }
      )
    }
    if (!existing.rejected) {
      return NextResponse.json(
        { error: 'Đơn đăng ký với email/SĐT này đang chờ xem xét.' },
        { status: 409 }
      )
    }
    // If rejected before, allow re-apply by updating the existing record
    const { error: updateErr } = await service
      .from('affiliate_profiles')
      .update({
        full_name: fullName,
        phone,
        email,
        partner_type: partnerType,
        primary_channel: primaryChannel,
        social_link: socialLink,
        estimated_audience: estimatedAudience,
        application_note: applicationNote,
        rejected: false,
        rejected_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (updateErr) {
      console.error('[affiliate/register] re-apply update:', updateErr)
      return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Đơn đăng ký đã được gửi lại.' })
  }

  // ── Insert new application ────────────────────────────────────────────────

  const { error: insertErr } = await service
    .from('affiliate_profiles')
    .insert({
      user_id: null,
      full_name: fullName,
      phone,
      email,
      partner_type: partnerType,
      primary_channel: primaryChannel,
      social_link: socialLink,
      estimated_audience: estimatedAudience,
      application_note: applicationNote,
      affiliate_tier: 'basic',
      is_approved: false,
      rejected: false,
    })

  if (insertErr) {
    console.error('[affiliate/register] insert:', insertErr)
    return NextResponse.json({ error: 'Không thể gửi đơn đăng ký.' }, { status: 500 })
  }

  // ── Notify admins ─────────────────────────────────────────────────────────

  const { data: admins } = await service
    .from('profiles')
    .select('id')
    .eq('role', 'admin')

  if (admins?.length) {
    const notifications = admins.map((a: { id: string }) => ({
      user_id: a.id,
      type: 'affiliate_application',
      channel: 'in_app',
      title: `Đơn đăng ký đối tác mới: ${fullName}`,
      content: `${fullName} (${partnerType}) đã đăng ký làm đối tác BodiX.`,
      metadata: { email, phone, partner_type: partnerType },
      sent_at: new Date().toISOString(),
    }))

    await service.from('notifications').insert(notifications)
  }

  return NextResponse.json({
    success: true,
    message: 'Cảm ơn bạn đã đăng ký! Chúng tôi sẽ xem xét và phản hồi trong 1-2 ngày làm việc.',
  })
}
