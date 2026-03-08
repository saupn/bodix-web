import { sendSMSviaESMS } from './esms-provider'

export async function sendSMS(phone: string, message: string): Promise<void> {
  const result = await sendSMSviaESMS({ phone, content: message, smsType: 8 })
  if (!result.success) {
    throw new Error(result.error ?? 'SMS send failed')
  }
}

export function buildOtpMessage(otp: string): string {
  return `[BodiX] Ma xac minh cua ban la: ${otp}. Co hieu luc trong 5 phut. Khong chia se ma nay cho bat ky ai.`
}
