/**
 * POST /api/webhooks/payment
 *
 * Webhook endpoint cho payment providers.
 * Route này được gọi bởi Stripe / VNPay server — KHÔNG phải client.
 *
 * Để test locally:
 *   Stripe:  stripe listen --forward-to localhost:3000/api/webhooks/payment
 *   VNPay:   dùng ngrok để expose localhost
 *
 * Setup trên Vercel:
 *   - Stripe:  Dashboard > Webhooks > Add endpoint → https://yourdomain.com/api/webhooks/payment
 *   - VNPay:   Cấu hình IPN URL trong merchant portal
 *
 * Env vars cần thêm khi tích hợp thật:
 *   STRIPE_WEBHOOK_SECRET    — từ Stripe Dashboard > Webhooks
 *   VNPAY_HASH_SECRET        — từ VNPay merchant portal
 */

import { NextResponse, type NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// TODO: Stripe webhook handler
// ---------------------------------------------------------------------------
// import Stripe from 'stripe'
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-11-20' })
//
// async function handleStripeWebhook(request: NextRequest): Promise<NextResponse> {
//   const body = await request.text()
//   const sig = request.headers.get('stripe-signature')!
//
//   // 1. Verify signature
//   let event: Stripe.Event
//   try {
//     event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
//   } catch (err) {
//     return NextResponse.json({ error: `Webhook signature invalid: ${err}` }, { status: 400 })
//   }
//
//   // 2. Handle events
//   switch (event.type) {
//     case 'checkout.session.completed': {
//       const session = event.data.object as Stripe.Checkout.Session
//       const enrollmentId = session.metadata?.enrollment_id
//       if (enrollmentId && session.payment_status === 'paid') {
//         // 3. Confirm payment → activate enrollment
//         await confirmEnrollment(enrollmentId, session.payment_intent as string)
//       }
//       break
//     }
//     case 'payment_intent.payment_failed': {
//       const intent = event.data.object as Stripe.PaymentIntent
//       const enrollmentId = intent.metadata?.enrollment_id
//       if (enrollmentId) {
//         // 4. Mark enrollment as failed / reset to pending
//         await handlePaymentFailed(enrollmentId)
//       }
//       break
//     }
//   }
//
//   return NextResponse.json({ received: true })
// }

// ---------------------------------------------------------------------------
// TODO: VNPay IPN handler
// ---------------------------------------------------------------------------
// async function handleVNPayIPN(request: NextRequest): Promise<NextResponse> {
//   const params = Object.fromEntries(new URL(request.url).searchParams)
//
//   // 1. Verify HMAC-SHA512 signature
//   const secureHash = params['vnp_SecureHash']
//   const isValid = vnpay.verifyReturnUrl(params, process.env.VNPAY_HASH_SECRET!)
//   if (!isValid) {
//     return NextResponse.json({ RspCode: '97', Message: 'Invalid signature' })
//   }
//
//   // 2. Parse result
//   const responseCode = params['vnp_ResponseCode']
//   const enrollmentId = params['vnp_TxnRef']  // truyền vào khi tạo payment URL
//
//   // 3. Handle result
//   if (responseCode === '00') {
//     // Payment success
//     await confirmEnrollment(enrollmentId, params['vnp_TransactionNo'])
//     return NextResponse.json({ RspCode: '00', Message: 'Confirm success' })
//   } else {
//     // Payment failed
//     await handlePaymentFailed(enrollmentId)
//     return NextResponse.json({ RspCode: '00', Message: 'Confirm success' })
//     // VNPay yêu cầu luôn trả 00 để xác nhận đã nhận IPN
//   }
// }

// ---------------------------------------------------------------------------
// Internal helpers (sẽ dùng khi tích hợp thật)
// ---------------------------------------------------------------------------
// import { createServiceClient } from '@/lib/supabase/service'
//
// async function confirmEnrollment(enrollmentId: string, paymentRef: string): Promise<void> {
//   // Gọi logic tương tự /api/checkout/confirm nhưng bypass auth
//   // (đây là server-to-server call, không có user session)
//   const service = createServiceClient()
//   // ... cùng logic assign cohort, activate enrollment, insert notification
// }
//
// async function handlePaymentFailed(enrollmentId: string): Promise<void> {
//   const service = createServiceClient()
//   await service
//     .from('enrollments')
//     .update({ status: 'pending_payment' })  // giữ nguyên để user retry
//     .eq('id', enrollmentId)
//     .eq('status', 'pending_payment')
//
//   // TODO: gửi thông báo "thanh toán thất bại, thử lại"
// }

// ---------------------------------------------------------------------------
// Placeholder handler (hiện tại)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // Detect provider từ headers
  const isStripe = request.headers.has('stripe-signature')
  const isVNPay = new URL(request.url).searchParams.has('vnp_ResponseCode')

  console.log(`[webhooks/payment] received – provider: ${isStripe ? 'stripe' : isVNPay ? 'vnpay' : 'unknown'}`)

  // Placeholder: luôn trả 200 để provider không retry liên tục
  return NextResponse.json({
    received: true,
    note: 'Payment webhook placeholder. Integration pending.',
  })
}

// VNPay cũng gửi GET request cho Return URL (redirect sau thanh toán)
export async function GET() {
  return NextResponse.json({
    received: true,
    note: 'VNPay return URL placeholder.',
  })
}
