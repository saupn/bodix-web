import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MessageResult } from "../types";

export interface PushPayload {
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface FcmErrorDetail {
  errorCode?: string;
}
interface FcmErrorResponse {
  error?: {
    code?: number;
    status?: string;
    message?: string;
    details?: FcmErrorDetail[];
  };
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export async function getFirebaseAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60_000) {
    return cachedAccessToken.token;
  }
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) {
    throw new Error("No Firebase access token returned");
  }
  cachedAccessToken = {
    token: tokenResponse.token,
    expiresAt: now + 50 * 60 * 1000,
  };
  return tokenResponse.token;
}

/**
 * Gửi FCM message tới một device token cụ thể.
 * Low-level — tự động xóa token khỏi DB nếu gặp UNREGISTERED.
 */
export async function sendFcmMessage(
  fcmToken: string,
  payload: PushPayload,
  ownerUserId?: string,
): Promise<MessageResult> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    return { success: false, error: "FIREBASE_PROJECT_ID not set" };
  }

  let accessToken: string;
  try {
    accessToken = await getFirebaseAccessToken();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "firebase_auth_failed";
    return { success: false, error: msg };
  }

  try {
    const resp = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            notification: {
              title: payload.title,
              body: payload.body,
            },
            data: {
              ...(payload.data ?? {}),
              type: payload.type,
              click_action: "FLUTTER_NOTIFICATION_CLICK",
            },
            android: {
              priority: "high",
              notification: {
                channel_id: "bodix_default",
                sound: "default",
              },
            },
            apns: {
              payload: {
                aps: { sound: "default", badge: 1 },
              },
            },
          },
        }),
      },
    );

    if (resp.ok) {
      const json = (await resp.json()) as { name?: string };
      return { success: true, messageId: json.name };
    }

    const errData = (await resp.json()) as FcmErrorResponse;
    console.error(`[push] FCM error:`, errData);

    const firstErrorCode = errData.error?.details?.[0]?.errorCode;
    const status = errData.error?.status;
    const isUnregistered =
      firstErrorCode === "UNREGISTERED" ||
      status === "NOT_FOUND" ||
      errData.error?.code === 404;

    if (isUnregistered && ownerUserId) {
      await supabaseAdmin
        .from("profiles")
        .update({ fcm_token: null })
        .eq("id", ownerUserId);
    }

    return {
      success: false,
      error: errData.error?.message ?? "fcm_error",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fcm_exception";
    return { success: false, error: msg };
  }
}

/**
 * Gửi push tới một user (tra profile, kiểm tra eligibility).
 * High-level — dùng khi chỉ có userId, chưa có profile.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<MessageResult> {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, fcm_token, notification_via")
    .eq("id", userId)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!profile?.fcm_token) {
    return { success: false, error: "no_fcm_token" };
  }
  if (profile.notification_via !== "push") {
    return { success: false, error: "push_disabled" };
  }

  return sendFcmMessage(profile.fcm_token, payload, userId);
}

/**
 * Quyết định kênh gửi dựa trên profile.
 * - 'push'  → user có app (fcm_token) và chưa opt-out
 * - 'zalo'  → user không có app nhưng có Zalo UID
 * - 'none'  → không có kênh nào khả dụng
 *
 * Quy tắc spec BD-28: hasApp ưu tiên push, KHÔNG gửi đồng thời Zalo.
 */
export function pickMessagingChannel(profile: {
  fcm_token: string | null;
  channel_user_id: string | null;
  notification_via: string | null;
}): "push" | "zalo" | "none" {
  if (profile.notification_via === "none") return "none";

  // Tôn trọng notification_via trước — user có thể có cả fcm_token (app cũ)
  // và channel_user_id (Zalo) đồng thời; preference quyết định kênh.
  if (profile.notification_via === "zalo") {
    if (profile.channel_user_id) return "zalo";
    if (profile.fcm_token) return "push"; // fallback nếu thiếu Zalo UID
    return "none";
  }
  if (profile.notification_via === "push") {
    if (profile.fcm_token) return "push";
    if (profile.channel_user_id) return "zalo"; // fallback nếu thiếu token
    return "none";
  }

  // notification_via chưa set → auto-pick
  if (profile.fcm_token) return "push";
  if (profile.channel_user_id) return "zalo";
  return "none";
}
