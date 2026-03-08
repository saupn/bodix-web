import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (raw.startsWith('+84') && digits.length === 11) return `+84${digits.slice(2)}`
  if (digits.startsWith('0') && digits.length === 10) return `+84${digits.slice(1)}`
  if (digits.length === 9) return `+84${digits}`
  return null
}

export async function POST(request: NextRequest) {
  let body: { phone?: unknown; otp?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (typeof body.phone !== 'string' || !body.phone.trim()) {
    return NextResponse.json({ error: 'Thiếu số điện thoại.' }, { status: 400 })
  }
  if (typeof body.otp !== 'string' || !/^\d{6}$/.test(body.otp.trim())) {
    return NextResponse.json({ error: 'OTP không hợp lệ (phải là 6 chữ số).' }, { status: 400 })
  }

  const phone = normalizePhone(body.phone.trim())
  if (!phone) {
    return NextResponse.json({ error: 'Số điện thoại không hợp lệ.' }, { status: 400 })
  }

  const otp = body.otp.trim()
  const service = createServiceClient()

  // --- Find the most recent unexpired, unverified OTP for this phone ---
  const { data: record, error: fetchError } = await service
    .from('phone_otps')
    .select('id, otp_code, expires_at')
    .eq('phone', phone)
    .eq('verified', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (fetchError || !record) {
    return NextResponse.json(
      { error: 'OTP không hợp lệ hoặc đã hết hạn.' },
      { status: 400 }
    )
  }

  if (record.otp_code !== otp) {
    return NextResponse.json({ error: 'Mã OTP không đúng.' }, { status: 400 })
  }

  // --- Mark OTP as verified ---
  await service.from('phone_otps').update({ verified: true }).eq('id', record.id)

  // --- Update the current user's profile ---
  const userSupabase = await createClient()
  const {
    data: { user },
  } = await userSupabase.auth.getUser()

  if (user) {
    await service
      .from('profiles')
      .update({ phone, phone_verified: true })
      .eq('id', user.id)
  }

  return NextResponse.json({ success: true, message: 'Số điện thoại đã được xác minh.' })
}
