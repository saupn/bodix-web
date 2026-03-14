import { MessageResult } from "../types";

export async function sendViaWhatsApp(
  _channelUserId: string,
  _text: string
): Promise<MessageResult> {
  throw new Error(
    "WhatsApp adapter not implemented yet. Coming in Year 3."
  );
}

export async function sendOTPViaWhatsApp(
  _phone: string,
  _otpCode: string
): Promise<MessageResult> {
  throw new Error(
    "WhatsApp adapter not implemented yet. Coming in Year 3."
  );
}
