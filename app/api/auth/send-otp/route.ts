import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendSMS, buildOtpMessage } from '@/lib/sms/provider'
import { authRateLimit, getClientIp, rateLimitExceeded } from '@/lib/middleware/rate-limit'

const RATE_LIMIT_COUNT = 3
const RATE_LIMIT_WINDOW_MINUTES = 10
const OTP_TTL_MINUTES = 5

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')

  // Already in international format: +84xxxxxxxxx
  if (raw.startsWith('+84') && digits.length === 11) {
    return `+84${digits.slice(2)}`
  }

  // Vietnamese local format: 0xxxxxxxxx (10 digits)
  if (digits.startsWith('0') && digits.length === 10) {
    return `+84${digits.slice(1)}`
  }

  // Bare 9-digit number (no leading 0)
  if (digits.length === 9) {
    return `+84${digits}`
  }

  return null
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function POST(request: NextRequest) {
  // IP-based rate limit (first line of defence before any DB queries)
  const ip = getClientIp(request)
  const rl = authRateLimit(ip)
  if (!rl.ok) return rateLimitExceeded(rl.resetIn)

  let body: { phone?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (typeof body.phone !== 'string' || !body.phone.trim()) {
    return NextResponse.json({ error: 'Thiếu số điện thoại.' }, { status: 400 })
  }

  const phone = normalizePhone(body.phone.trim())
  if (!phone) {
    return NextResponse.json({ error: 'Số điện thoại không hợp lệ.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // --- Rate limiting ---
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString()
  const { count, error: countError } = await supabase
    .from('phone_otps')
    .select('*', { count: 'exact', head: true })
    .eq('phone', phone)
    .gte('created_at', windowStart)

  if (countError) {
    console.error('[send-otp] rate limit check failed:', countError)
    return NextResponse.json({ error: 'Lỗi server. Vui lòng thử lại.' }, { status: 500 })
  }

  if ((count ?? 0) >= RATE_LIMIT_COUNT) {
    return NextResponse.json(
      { error: `Đã gửi quá ${RATE_LIMIT_COUNT} OTP trong ${RATE_LIMIT_WINDOW_MINUTES} phút. Vui lòng thử lại sau.` },
      { status: 429 }
    )
  }

  // --- Generate & store OTP ---
  const otp = generateOtp()
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString()

  const { error: insertError } = await supabase.from('phone_otps').insert({
    phone,
    otp_code: otp,
    expires_at: expiresAt,
    verified: false,
  })

  if (insertError) {
    console.error('[send-otp] insert failed:', insertError)
    return NextResponse.json({ error: 'Lỗi server. Vui lòng thử lại.' }, { status: 500 })
  }

  // --- Send SMS ---
  try {
    await sendSMS(phone, buildOtpMessage(otp))
  } catch (err) {
    console.error('[send-otp] SMS failed:', err)
    return NextResponse.json({ error: 'Không gửi được SMS. Vui lòng thử lại.' }, { status: 502 })
  }

  // --- Save phone to profile (so it's persisted even if user doesn't complete OTP) ---
  const userSupabase = await createClient()
  const {
    data: { user },
  } = await userSupabase.auth.getUser()

  if (user) {
    await supabase
      .from('profiles')
      .update({ phone })
      .eq('id', user.id)
  }

  return NextResponse.json({ success: true, message: `OTP đã gửi đến ${phone}.` })
}
