import { MessageResult } from "../types";
import { getAccessToken } from "../helpers";

const ZALO_OA_MESSAGE_URL = "https://openapi.zalo.me/v3.0/oa/message/cs";
const ZALO_ZNS_TEMPLATE_URL = "https://business.openapi.zalo.me/message/template";

/**
 * Gửi tin nhắn văn bản qua Zalo OA.
 */
export async function sendViaZalo(
  channelUserId: string,
  text: string
): Promise<MessageResult> {
  const accessToken = await getAccessToken();

  const res = await fetch(ZALO_OA_MESSAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: accessToken,
    },
    body: JSON.stringify({
      recipient: { user_id: channelUserId },
      message: { text },
    }),
  });

  const data = (await res.json()) as { error?: number; message?: string };

  if (data.error === 0) {
    return { success: true };
  }

  return {
    success: false,
    error: data.message ?? `Zalo API error: ${data.error ?? res.status}`,
  };
}

/**
 * Gửi OTP qua Zalo ZNS (Zalo Notification Service).
 * Cần template đã được Zalo duyệt.
 */
export async function sendOTPViaZalo(
  phone: string,
  otpCode: string
): Promise<MessageResult> {
  const accessToken = await getAccessToken();
  const templateId = process.env.ZALO_OTP_TEMPLATE_ID;

  if (!templateId) {
    return {
      success: false,
      error: "ZALO_OTP_TEMPLATE_ID not configured",
    };
  }

  const res = await fetch(ZALO_ZNS_TEMPLATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: accessToken,
    },
    body: JSON.stringify({
      phone: phone.startsWith("84") ? phone : `84${phone.replace(/^0/, "")}`,
      template_id: templateId,
      template_data: { otp: otpCode },
      tracking_id: `otp_${Date.now()}`,
    }),
  });

  const data = (await res.json()) as { error?: number; message?: string };

  if (data.error === 0) {
    return { success: true };
  }

  return {
    success: false,
    error: data.message ?? `Zalo ZNS error: ${data.error ?? res.status}`,
  };
}
