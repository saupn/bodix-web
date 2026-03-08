import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const MIN_WITHDRAWAL = 200_000   // 200k VND
const WITHDRAWAL_NOTIFY_URL = '/admin/affiliates/withdrawals'

// ─── POST — Yêu cầu rút tiền ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  let body: { amount: number }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const { amount } = body

  if (!Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount phải là số nguyên dương.' }, { status: 400 })
  }

  if (amount < MIN_WITHDRAWAL) {
    return NextResponse.json({
      error: `Số tiền rút tối thiểu là ${MIN_WITHDRAWAL.toLocaleString('vi-VN')}đ.`,
      min_withdrawal: MIN_WITHDRAWAL,
    }, { status: 400 })
  }

  // ── Fetch affiliate profile ───────────────────────────────────────────────
  const { data: affiliate, error: profileError } = await supabase
    .from('affiliate_profiles')
    .select('id, is_approved, pending_balance, bank_name, bank_account_number, bank_account_name')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[affiliate/withdraw] profile:', profileError)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }

  if (!affiliate) {
    return NextResponse.json({ error: 'Bạn chưa đăng ký affiliate.' }, { status: 404 })
  }

  if (!affiliate.is_approved) {
    return NextResponse.json({ error: 'Tài khoản affiliate chưa được duyệt.' }, { status: 403 })
  }

  if (!affiliate.bank_account_number) {
    return NextResponse.json({
      error: 'Vui lòng cập nhật thông tin tài khoản ngân hàng trước khi rút tiền.',
    }, { status: 400 })
  }

  // ── Validate balance ──────────────────────────────────────────────────────
  const currentBalance = affiliate.pending_balance ?? 0
  if (amount > currentBalance) {
    return NextResponse.json({
      error: 'Số tiền rút vượt quá số dư khả dụng.',
      pending_balance: currentBalance,
      requested: amount,
    }, { status: 400 })
  }

  const service = createServiceClient()

  // ── Deduct from pending_balance ───────────────────────────────────────────
  const newBalance = currentBalance - amount
  const { error: deductError } = await service
    .from('affiliate_profiles')
    .update({
      pending_balance: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq('id', affiliate.id)

  if (deductError) {
    console.error('[affiliate/withdraw] deduct:', deductError)
    return NextResponse.json({ error: 'Không thể xử lý yêu cầu rút tiền.' }, { status: 500 })
  }

  // ── Insert user_credits record (negative amount = debit) ─────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const { data: creditRecord, error: creditError } = await service
    .from('user_credits')
    .insert({
      user_id: user.id,
      amount: -amount,
      balance_after: newBalance,
      transaction_type: 'withdrawal',
      withdrawal_status: 'pending',
      description: `Yêu cầu rút tiền — ${affiliate.bank_name ?? ''} ${affiliate.bank_account_number}`,
    })
    .select('id')
    .single()

  if (creditError) {
    console.error('[affiliate/withdraw] credit record:', creditError)
    // Non-fatal — balance already deducted; reconcile manually if needed
  }

  const withdrawalId = creditRecord?.id ?? null

  // ── Notify admins ─────────────────────────────────────────────────────────
  const { data: admins } = await service
    .from('profiles')
    .select('id')
    .eq('role', 'admin')

  if (admins?.length) {
    const applicantName = profile?.full_name?.trim() || 'Affiliate'
    const notifications = admins.map(admin => ({
      user_id: admin.id,
      type: 'admin_withdrawal_request',
      channel: 'in_app',
      title: `Yêu cầu rút tiền: ${amount.toLocaleString('vi-VN')}đ`,
      content: `${applicantName} yêu cầu rút ${amount.toLocaleString('vi-VN')}đ về ${affiliate.bank_name ?? 'ngân hàng'} ${affiliate.bank_account_number}.`,
      metadata: {
        withdrawal_id: withdrawalId,
        affiliate_user_id: user.id,
        amount,
        bank_name: affiliate.bank_name,
        bank_account_number: affiliate.bank_account_number,
        bank_account_name: affiliate.bank_account_name,
        action_url: WITHDRAWAL_NOTIFY_URL,
      },
    }))

    const { error: notifError } = await service.from('notifications').insert(notifications)
    if (notifError) console.error('[affiliate/withdraw] notify admin:', notifError)
  }

  return NextResponse.json({
    withdrawal_id: withdrawalId,
    status: 'processing',
    amount,
    balance_after: newBalance,
    message: 'Yêu cầu rút tiền đã được ghi nhận. Chúng tôi sẽ chuyển khoản trong 1–3 ngày làm việc.',
    bank_info: {
      bank_name: affiliate.bank_name,
      account_number: affiliate.bank_account_number,
      account_name: affiliate.bank_account_name,
    },
  })
}
