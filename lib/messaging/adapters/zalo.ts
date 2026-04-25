import { MessageResult } from "../types";
import { getAccessToken } from "../helpers";

const ZALO_OA_MESSAGE_URL = "https://openapi.zalo.me/v3.0/oa/message/cs";
const ZALO_ZNS_TEMPLATE_URL = "https://business.openapi.zalo.me/message/template";

/**
 * Gửi tin nhắn văn bản qua Zalo OA.
 * AbortController timeout 5s để tránh treo nếu Zalo API chậm.
 */
export async function sendViaZalo(
  channelUserId: string,
  text: string
): Promise<MessageResult> {
  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (error: unknown) {
    const err = error as { message?: string; cause?: unknown };
    console.error("[zalo] sendViaZalo getAccessToken FAILED:", err?.message, err?.cause);
    return {
      success: false,
      error: err?.message ?? "getAccessToken failed",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
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
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = (await res.json()) as { error?: number; message?: string };
    console.log("[zalo] send result:", JSON.stringify(data));

    if (data.error === 0) {
      return { success: true };
    }

    console.error("[zalo] API error:", data.error, data.message);
    return {
      success: false,
      error: data.message ?? `Zalo API error: ${data.error ?? res.status}`,
    };
  } catch (error: unknown) {
    clearTimeout(timeout);
    const err = error as { name?: string; message?: string; cause?: unknown };
    console.error("[zalo] sendViaZalo FAILED:", err?.name, err?.message, err?.cause);
    return {
      success: false,
      error: err?.message ?? "fetch failed",
    };
  }
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
