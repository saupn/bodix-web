export type MessageChannel =
  | "zalo"
  | "whatsapp"
  | "telegram"
  | "line"
  | "email";

export interface SendMessageParams {
  userId: string; // Supabase user ID (để log)
  channel: MessageChannel;
  channelUserId: string; // UID trên kênh đó (Zalo UID, WhatsApp phone, Telegram chat_id...)
  text: string;
}

export interface SendOTPParams {
  phone: string; // Format quốc tế: 84xxxxxxxxx
  channel: MessageChannel;
  otpCode: string;
}

export interface MessageResult {
  success: boolean;
  error?: string;
  messageId?: string;
}
