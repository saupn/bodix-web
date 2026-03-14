import type { SendMessageParams, SendOTPParams, MessageResult } from "./types";
import { sendViaZalo, sendOTPViaZalo } from "./adapters/zalo";
import { sendViaWhatsApp, sendOTPViaWhatsApp } from "./adapters/whatsapp";

/**
 * Gửi tin nhắn văn bản qua kênh chỉ định.
 */
export async function sendMessage(
  params: SendMessageParams
): Promise<MessageResult> {
  const { userId, channel, channelUserId, text } = params;

  let result: MessageResult;

  switch (channel) {
    case "zalo":
      result = await sendViaZalo(channelUserId, text);
      break;
    case "whatsapp":
      result = await sendViaWhatsApp(channelUserId, text);
      break;
    default:
      throw new Error(`Channel not implemented yet: ${channel}`);
  }

  if (!result.success) {
    console.error(`[messaging] sendMessage failed | userId=${userId} | channel=${channel}`, result.error);
  }

  return result;
}

/**
 * Gửi OTP qua kênh chỉ định.
 */
export async function sendOTP(params: SendOTPParams): Promise<MessageResult> {
  const { phone, channel, otpCode } = params;

  let result: MessageResult;

  switch (channel) {
    case "zalo":
      result = await sendOTPViaZalo(phone, otpCode);
      break;
    case "whatsapp":
      result = await sendOTPViaWhatsApp(phone, otpCode);
      break;
    default:
      throw new Error(`Channel not implemented yet: ${channel}`);
  }

  if (!result.success) {
    console.error(`[messaging] sendOTP failed | phone=${phone} | channel=${channel}`, result.error);
  }

  return result;
}

// Re-export types for consumers
export type { SendMessageParams, SendOTPParams, MessageResult, MessageChannel } from "./types";
export { getAccessToken, formatPhoneVN } from "./helpers";
