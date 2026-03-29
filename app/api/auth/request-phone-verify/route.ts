import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { safeParseBody } from '@/lib/validation/schemas'

const phoneSchema = z.object({
  phone: z.string().regex(/^0\d{9}$/, 'SĐT phải gồm 10 chữ số, bắt đầu bằng 0.'),
})

const RATE_LIMIT_COUNT = 5
const RATE_LIMIT_WINDOW_MINUTES = 30
const CODE_TTL_MINUTES = 15

export async function POST(request: NextRequest) {
  // 1. Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  // 2. Validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = safeParseBody(phoneSchema, body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { phone } = parsed.data

  const service = createServiceClient()

  // 3. Rate limit: max 5 records in 30 minutes per user
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString()
  const { count, error: countError } = await service
    .from('phone_verifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', windowStart)

  if (countError) {
    console.error('[request-phone-verify] rate limit check:', countError)
    return NextResponse.json({ error: 'Lỗi server.' }, { status: 500 })
  }

  if ((count ?? 0) >= RATE_LIMIT_COUNT) {
    return NextResponse.json(
      { error: `Đã gửi quá ${RATE_LIMIT_COUNT} mã trong ${RATE_LIMIT_WINDOW_MINUTES} phút. Vui lòng thử lại sau.` },
      { status: 429 },
    )
  }

  // 4. Check existing pending code (not expired)
  const { data: existing } = await service
    .from('phone_verifications')
    .select('verify_code, expires_at')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    const expiresIn = Math.max(0, Math.floor((new Date(existing.expires_at).getTime() - Date.now()) / 1000))
    return NextResponse.json({
      verify_code: existing.verify_code,
      expires_in: expiresIn,
      zalo_oa_link: `https://zalo.me/${process.env.NEXT_PUBLIC_ZALO_OA_ID}`,
    })
  }

  // 5. Expire all old pending codes for this user
  await service
    .from('phone_verifications')
    .update({ status: 'expired' })
    .eq('user_id', user.id)
    .eq('status', 'pending')

  // 6. Generate verify code via DB function
  const { data: codeRow, error: codeError } = await service
    .rpc('generate_verify_code')

  if (codeError || !codeRow) {
    console.error('[request-phone-verify] generate_verify_code:', codeError)
    return NextResponse.json({ error: 'Lỗi server.' }, { status: 500 })
  }

  const verifyCode = codeRow as string
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString()

  // 7. Insert new verification record
  const { error: insertError } = await service
    .from('phone_verifications')
    .insert({
      user_id: user.id,
      phone,
      verify_code: verifyCode,
      expires_at: expiresAt,
    })

  if (insertError) {
    console.error('[request-phone-verify] insert:', insertError)
    return NextResponse.json({ error: 'Lỗi server.' }, { status: 500 })
  }

  return NextResponse.json({
    verify_code: verifyCode,
    expires_in: CODE_TTL_MINUTES * 60,
    zalo_oa_link: `https://zalo.me/${process.env.NEXT_PUBLIC_ZALO_OA_ID}`,
  })
}
