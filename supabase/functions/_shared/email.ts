/**
 * TODO: Tích hợp provider email thật.
 *
 * Gợi ý tích hợp:
 *   - Resend    : https://resend.com/docs — đơn giản nhất, hỗ trợ React Email
 *   - SendGrid  : https://docs.sendgrid.com/for-developers/sending-email
 *   - AWS SES   : qua fetch() đến SES API endpoint
 *
 * Để lấy email của user:
 *   const { data } = await supabase.auth.admin.getUserById(userId)
 *   const email = data.user?.email
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  console.log(`[email mock] to=${to} | subject=${subject}`)
  console.log(`[email mock] body=${body}`)
  return true
}
