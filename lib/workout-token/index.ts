// Server-only module: dùng node crypto + service-role client. KHÔNG import vào
// Client Component (sẽ lộ secret). Không dùng package `server-only` vì repo chưa
// cài; ràng buộc giữ bằng convention + việc import crypto/service.
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Magic-link phiên tập — token + cookie scoped (Option 2 từ audit Giai đoạn 1).
//
// Luồng:
//  1. Cron morning sinh token (DB) gắn user_id → link bodix.fit/w/[token].
//  2. /w/[token] verify token (DB, service) → set cookie SIGNED chứa
//     {uid, scope, exp} (KHÔNG chứa raw token) → redirect thẳng phiên tập.
//  3. 2 route workout + check-in API chấp nhận session đầy đủ HOẶC cookie này.
//
// Cookie tự xác thực bằng HMAC → KHÔNG cần hit DB mỗi request (reusable, mượt).
// DB token chỉ verify 1 lần lúc đổi lấy cookie ở /w/[token].
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const WORKOUT_COOKIE_NAME = "bodix_workout_token";
export const WORKOUT_TOKEN_SCOPE = "workout_checkin";
export const WORKOUT_TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24h

/** Paths mà cookie workout-token được phép mở (whitelist tuyệt đối). */
export const WORKOUT_TOKEN_PATH_PREFIXES = [
  "/app/program/workout",
  "/app/trial/workout",
] as const;

export function isWorkoutTokenPath(pathname: string): boolean {
  return WORKOUT_TOKEN_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Secret ký cookie. Ưu tiên WORKOUT_COOKIE_SECRET; fallback service role key
 * (luôn có server-side) để không vỡ build/runtime nếu chưa set env riêng.
 */
function cookieSecret(): string {
  const s =
    process.env.WORKOUT_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("[workout-token] missing signing secret");
  return s;
}

// ── DB token ────────────────────────────────────────────────────────────────

export interface WorkoutTokenRow {
  user_id: string;
  enrollment_id: string | null;
  scope: string;
  expires_at: string;
}

/**
 * Sinh token mới (random 32 byte base64url), INSERT vào DB, hết hạn 24h.
 * @param userId       resolve từ enrollment.user_id (an toàn, KHÔNG channel_user_id)
 * @param enrollmentId enrollment liên quan (optional)
 */
export async function generateWorkoutToken(
  userId: string,
  enrollmentId?: string | null
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + WORKOUT_TOKEN_TTL_SECONDS * 1000
  ).toISOString();

  const service = createServiceClient();
  const { error } = await service.from("workout_access_tokens").insert({
    token,
    user_id: userId,
    enrollment_id: enrollmentId ?? null,
    scope: WORKOUT_TOKEN_SCOPE,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(`[workout-token] insert failed: ${error.message}`);
  }
  return token;
}

/**
 * Verify token từ DB. Trả null nếu không tồn tại / đã hết hạn.
 * Cập nhật last_used_at (KHÔNG xóa — reusable đến hết hạn).
 */
export async function verifyWorkoutToken(
  token: string
): Promise<WorkoutTokenRow | null> {
  if (!token || token.length < 16) return null;

  const service = createServiceClient();
  const { data, error } = await service
    .from("workout_access_tokens")
    .select("user_id, enrollment_id, scope, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;

  // Reusable: chỉ đánh dấu last_used_at, không vô hiệu hoá token.
  await service
    .from("workout_access_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token", token);

  return data as WorkoutTokenRow;
}

// ── Signed cookie ─────────────────────────────────────────────────────────────

interface CookiePayload {
  uid: string;
  scope: string;
  exp: number; // unix seconds
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(payloadB64: string): string {
  return b64url(createHmac("sha256", cookieSecret()).update(payloadB64).digest());
}

/** Tạo giá trị cookie SIGNED: `${base64url(json)}.${base64url(hmac)}`. */
export function encodeWorkoutCookie(uid: string, expSeconds: number): string {
  const payload: CookiePayload = { uid, scope: WORKOUT_TOKEN_SCOPE, exp: expSeconds };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload)));
  return `${payloadB64}.${sign(payloadB64)}`;
}

/**
 * Giải mã + xác thực cookie. Trả null nếu sai chữ ký / sai cấu trúc / hết hạn /
 * sai scope. Pure — không hit DB.
 */
export function decodeWorkoutCookie(
  raw: string | undefined | null
): { userId: string; scope: string } | null {
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot <= 0) return null;

  const payloadB64 = raw.slice(0, dot);
  const sigB64 = raw.slice(dot + 1);

  const expected = sign(payloadB64);
  const a = Buffer.from(sigB64);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let parsed: CookiePayload;
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (
    !parsed ||
    typeof parsed.uid !== "string" ||
    parsed.scope !== WORKOUT_TOKEN_SCOPE ||
    typeof parsed.exp !== "number"
  ) {
    return null;
  }
  if (parsed.exp * 1000 <= Date.now()) return null;

  return { userId: parsed.uid, scope: parsed.scope };
}

/** Cookie options dùng khi set ở route /w/[token]. */
export function workoutCookieOptions(expSeconds: number) {
  const maxAge = Math.max(0, expSeconds - Math.floor(Date.now() / 1000));
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

// ── Request-level auth (session-or-token) ─────────────────────────────────────

export interface WorkoutAccess {
  userId: string;
  /** true nếu là session Supabase đầy đủ; false nếu chỉ có workout-token cookie. */
  full: boolean;
}

/**
 * Resolve user cho 2 route workout + check-in API.
 * Ưu tiên session Supabase đầy đủ; nếu không có thì chấp nhận cookie workout-token.
 * Trả null nếu cả hai đều không hợp lệ.
 *
 * Dùng dynamic import cho createClient (server.ts đọc next/headers cookies) để
 * giữ module này an toàn khi import từ context khác.
 */
export async function getWorkoutRequestUser(
  request: NextRequest
): Promise<WorkoutAccess | null> {
  // 1. Session đầy đủ
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return { userId: user.id, full: true };
  } catch {
    // ignore — thử token cookie
  }

  // 2. Workout-token cookie
  const raw = request.cookies.get(WORKOUT_COOKIE_NAME)?.value;
  const decoded = decodeWorkoutCookie(raw);
  if (decoded) return { userId: decoded.userId, full: false };

  return null;
}
