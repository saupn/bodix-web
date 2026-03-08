/**
 * SMS provider abstraction for BodiX.
 * TODO: Tích hợp SpeedSMS / eSMS / Twilio bằng cách thay thế phần bên dưới.
 *
 * SpeedSMS: https://speedsms.vn/sms-api/
 * eSMS:     https://esms.vn/
 * Twilio:   https://www.twilio.com/docs/sms
 */

export async function sendSMS(phone: string, message: string): Promise<void> {
  // TODO: replace with real provider
  console.log(`[SMS mock] To: ${phone} | Message: ${message}`)
}

export function buildOtpMessage(otp: string): string {
  return `[BodiX] Ma xac minh cua ban la: ${otp}. Co hieu luc trong 5 phut. Khong chia se ma nay cho bat ky ai.`
}
