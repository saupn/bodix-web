// eSMS API documentation: https://developers.esms.vn

interface ESMSResponse {
  CodeResult: string      // "100" = thành công
  CountRegenerate: number
  SMSID: string
  ErrorMessage?: string
}

export async function sendSMSviaESMS(params: {
  phone: string
  content: string
  smsType?: number  // 8 = OTP qua đầu số ngẫu nhiên (không cần brandname)
}): Promise<{ success: boolean; smsId?: string; error?: string }> {
  try {
    const apiKey = process.env.ESMS_API_KEY
    const secretKey = process.env.ESMS_SECRET_KEY

    if (!apiKey || !secretKey) {
      console.error('[eSMS] Missing ESMS credentials')
      return { success: false, error: 'Missing ESMS credentials' }
    }

    // Normalize phone: 0901234567 → 84901234567
    let normalizedPhone = params.phone.trim()
    if (normalizedPhone.startsWith('+84')) {
      normalizedPhone = normalizedPhone.substring(1) // bỏ dấu +
    } else if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '84' + normalizedPhone.substring(1)
    }

    const response = await fetch(
      'https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ApiKey: apiKey,
          SecretKey: secretKey,
          Phone: normalizedPhone,
          Content: params.content,
          SmsType: params.smsType ?? 8, // 8 = OTP
          Sandbox: process.env.ESMS_SANDBOX === 'true' ? 1 : 0,
          // Sandbox=1: test không gửi tin thật, không trừ tiền
        }),
      }
    )

    const data: ESMSResponse = await response.json()

    if (data.CodeResult === '100') {
      console.log(`[eSMS] SMS sent to ${normalizedPhone}, SMSID: ${data.SMSID}`)
      return { success: true, smsId: data.SMSID }
    } else {
      console.error(`[eSMS] SMS failed: ${data.CodeResult} - ${data.ErrorMessage}`)
      return { success: false, error: `${data.CodeResult}: ${data.ErrorMessage}` }
    }
  } catch (error) {
    console.error('[eSMS] SMS error:', error)
    return { success: false, error: String(error) }
  }
}

// Gửi Zalo ZNS qua eSMS (dùng sau, khi cần)
export async function sendZaloZNSviaESMS(params: {
  phone: string
  templateId: string
  templateData: Record<string, string | number>
  oaId: string
}): Promise<{ success: boolean; smsId?: string; error?: string }> {
  try {
    const apiKey = process.env.ESMS_API_KEY
    const secretKey = process.env.ESMS_SECRET_KEY

    if (!apiKey || !secretKey) {
      return { success: false, error: 'Missing ESMS credentials' }
    }

    let normalizedPhone = params.phone.trim()
    if (normalizedPhone.startsWith('+84')) {
      normalizedPhone = normalizedPhone.substring(1)
    } else if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '84' + normalizedPhone.substring(1)
    }

    const response = await fetch(
      'https://rest.esms.vn/MainService.svc/json/SendZaloMessage_V4_post_json/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ApiKey: apiKey,
          SecretKey: secretKey,
          Phone: normalizedPhone,
          TempID: params.templateId,
          OAID: params.oaId,
          Params: Object.values(params.templateData).map(String),
          // Params phải là array theo đúng thứ tự tham số trong template
          Sandbox: process.env.ESMS_SANDBOX === 'true' ? 1 : 0,
        }),
      }
    )

    const data: ESMSResponse = await response.json()

    if (data.CodeResult === '100') {
      return { success: true, smsId: data.SMSID }
    } else {
      return { success: false, error: `${data.CodeResult}: ${data.ErrorMessage}` }
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
