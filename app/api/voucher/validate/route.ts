import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/voucher/validate?code=V-XXXXX
 * Validate a voucher code for use at checkout.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  const code = request.nextUrl.searchParams.get('code')?.trim().toUpperCase()
  if (!code) {
    return NextResponse.json({ valid: false, reason: 'missing_code' })
  }

  const { data: voucher, error } = await supabase
    .from('vouchers')
    .select('id, user_id, code, amount, remaining_amount, status, expires_at')
    .eq('code', code)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[voucher/validate] query error:', error)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }

  if (!voucher) {
    return NextResponse.json({ valid: false, reason: 'not_found' })
  }

  if (voucher.status !== 'active') {
    return NextResponse.json({ valid: false, reason: 'not_active' })
  }

  if (new Date(voucher.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, reason: 'expired' })
  }

  if (voucher.remaining_amount <= 0) {
    return NextResponse.json({ valid: false, reason: 'no_balance' })
  }

  return NextResponse.json({
    valid: true,
    voucher_id: voucher.id,
    code: voucher.code,
    remaining_amount: voucher.remaining_amount,
    expires_at: voucher.expires_at,
  })
}
