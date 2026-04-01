/**
 * scripts/test-zalo.ts
 *
 * Interactive test script for Zalo OA messaging.
 * Usage: npx tsx scripts/test-zalo.ts
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   ZALO_APP_ID, ZALO_APP_SECRET, ZALO_OA_ID
 */

import * as readline from "readline";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ZALO_APP_ID = process.env.ZALO_APP_ID ?? "";
const ZALO_APP_SECRET = process.env.ZALO_APP_SECRET ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> => new Promise((r) => rl.question(q, r));

let cachedToken: string | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const { data, error } = await supabase
    .from("zalo_tokens")
    .select("access_token")
    .eq("id", 1)
    .single();

  if (error || !data?.access_token) {
    throw new Error(`Cannot read zalo_tokens: ${error?.message ?? "no row"}`);
  }
  cachedToken = data.access_token as string;
  return cachedToken;
}

function ok(msg: string) { console.log(`\n✅ ${msg}`); }
function fail(msg: string) { console.log(`\n❌ ${msg}`); }
function info(msg: string) { console.log(`   ${msg}`); }

// ─── 1. OA Info ──────────────────────────────────────────────────────────────

async function checkOAInfo() {
  console.log("\n── Kiểm tra OA Info ──");
  const token = await getToken();

  const res = await fetch("https://openapi.zalo.me/v2.0/oa/getoa", {
    headers: { access_token: token },
  });
  const data = await res.json();

  if (data.error === 0) {
    ok("OA Info:");
    info(`Tên:       ${data.data.name}`);
    info(`OA ID:     ${data.data.oa_id}`);
    info(`Followers: ${data.data.num_follower}`);
    info(`Package:   ${data.data.package_name ?? "N/A"}`);
    info(`Verified:  ${data.data.is_verified ? "Yes" : "No"}`);
  } else {
    fail(`Zalo API error ${data.error}: ${data.message}`);
  }
}

// ─── 2. Followers ────────────────────────────────────────────────────────────

async function getFollowers() {
  console.log("\n── Danh sách Followers ──");
  const token = await getToken();

  const params = encodeURIComponent(JSON.stringify({ offset: 0, count: 10 }));
  const res = await fetch(
    `https://openapi.zalo.me/v2.0/oa/getfollowers?data=${params}`,
    { headers: { access_token: token } },
  );
  const data = await res.json();

  if (data.error === 0) {
    const total = data.data.total;
    const followers: string[] = data.data.followers ?? [];
    ok(`${total} followers total, showing first ${followers.length}:`);
    followers.forEach((uid: string, i: number) => info(`  ${i + 1}. ${uid}`));
    return followers;
  } else {
    fail(`Zalo API error ${data.error}: ${data.message}`);
    return [];
  }
}

// ─── 3. Send CS Message ──────────────────────────────────────────────────────

async function sendCSMessage() {
  console.log("\n── Gửi tin Tư vấn (CS) ──");
  const token = await getToken();

  let uid = await ask("  UID người nhận (Enter để lấy follower đầu tiên): ");
  uid = uid.trim();

  if (!uid) {
    const followers = await getFollowers();
    if (followers.length === 0) {
      fail("Không có follower nào.");
      return;
    }
    uid = followers[0];
    info(`Dùng UID: ${uid}`);
  }

  const text = "🧪 Test BodiX — Tin Tư vấn hoạt động!";
  const res = await fetch("https://openapi.zalo.me/v3.0/oa/message/cs", {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: token },
    body: JSON.stringify({
      recipient: { user_id: uid },
      message: { text },
    }),
  });
  const data = await res.json();

  if (data.error === 0) {
    ok(`Đã gửi tin tới ${uid}`);
    info(`Message ID: ${data.data?.message_id ?? "N/A"}`);
  } else {
    fail(`Error ${data.error}: ${data.message}`);
    if (data.error === -201) info("Hint: User phải nhắn tin cho OA trước (24h window).");
    if (data.error === -216) info("Hint: Token hết hạn. Chạy option 6 để refresh.");
  }
}

// ─── 4. Send ZNS OTP ────────────────────────────────────────────────────────

async function sendZNSOtp() {
  console.log("\n── Gửi ZNS OTP Template ──");
  const templateId = process.env.ZALO_OTP_TEMPLATE_ID;

  if (!templateId) {
    fail("ZALO_OTP_TEMPLATE_ID chưa được cấu hình trong .env.local");
    return;
  }

  const token = await getToken();
  let phone = await ask("  SĐT (format 84xxx hoặc 0xxx): ");
  phone = phone.trim();

  if (phone.startsWith("0") && phone.length === 10) {
    phone = "84" + phone.slice(1);
  }
  if (!phone.startsWith("84") || phone.length !== 11) {
    fail(`SĐT không hợp lệ: ${phone}. Cần 84xxxxxxxxx (11 số).`);
    return;
  }

  const otp = "123456";
  info(`Gửi OTP "${otp}" tới ${phone} (template: ${templateId})`);

  const res = await fetch("https://business.openapi.zalo.me/message/template", {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: token },
    body: JSON.stringify({
      phone,
      template_id: templateId,
      template_data: { otp },
      tracking_id: `test_${Date.now()}`,
    }),
  });
  const data = await res.json();

  if (data.error === 0) {
    ok(`ZNS OTP đã gửi tới ${phone}`);
    info(`Message ID: ${data.data?.msg_id ?? "N/A"}`);
  } else {
    fail(`Error ${data.error}: ${data.message}`);
    if (data.error === -124) info("Hint: Template chưa được Zalo duyệt.");
  }
}

// ─── 5. Check Token ──────────────────────────────────────────────────────────

async function checkToken() {
  console.log("\n── Kiểm tra Token ──");

  const { data, error } = await supabase
    .from("zalo_tokens")
    .select("access_token, refresh_token, expires_at, updated_at")
    .eq("id", 1)
    .single();

  if (error || !data) {
    fail(`Không đọc được zalo_tokens: ${error?.message ?? "no row"}`);
    return;
  }

  const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
  const updatedAt = data.updated_at ? new Date(data.updated_at) : null;
  const now = new Date();
  const isExpired = expiresAt ? expiresAt < now : true;

  info(`Token:      ${data.access_token?.slice(0, 20)}...`);
  info(`Refresh:    ${data.refresh_token ? data.refresh_token.slice(0, 20) + "..." : "N/A"}`);
  info(`Expires at: ${expiresAt?.toLocaleString("vi-VN") ?? "N/A"}`);
  info(`Updated at: ${updatedAt?.toLocaleString("vi-VN") ?? "N/A"}`);

  if (isExpired) {
    fail("Token đã hết hạn!");
    const answer = await ask("  Refresh token ngay? (y/N): ");
    if (answer.trim().toLowerCase() === "y") {
      await refreshToken();
    }
  } else {
    const hoursLeft = Math.round((expiresAt!.getTime() - now.getTime()) / 3_600_000);
    ok(`Token còn hiệu lực (~${hoursLeft}h)`);
  }
}

// ─── 6. Refresh Token ────────────────────────────────────────────────────────

async function refreshToken() {
  console.log("\n── Refresh Token ──");

  if (!ZALO_APP_ID || !ZALO_APP_SECRET) {
    fail("Thiếu ZALO_APP_ID hoặc ZALO_APP_SECRET trong .env.local");
    return;
  }

  const { data: row, error } = await supabase
    .from("zalo_tokens")
    .select("refresh_token")
    .eq("id", 1)
    .single();

  if (error || !row?.refresh_token) {
    fail(`Không có refresh_token: ${error?.message ?? "empty"}`);
    return;
  }

  info("Đang refresh...");

  const res = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", secret_key: ZALO_APP_SECRET },
    body: new URLSearchParams({
      refresh_token: row.refresh_token,
      app_id: ZALO_APP_ID,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();

  if (data.access_token) {
    const expiresAt = new Date(Date.now() + (data.expires_in ?? 86400) * 1000).toISOString();

    await supabase
      .from("zalo_tokens")
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? row.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    cachedToken = data.access_token;
    ok("Token đã refresh thành công!");
    info(`Expires at: ${new Date(expiresAt).toLocaleString("vi-VN")}`);
  } else {
    fail(`Refresh failed: ${data.error_name ?? data.error} — ${data.error_description ?? data.error_reason ?? JSON.stringify(data)}`);
  }
}

// ─── Menu ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔═══════════════════════════════════╗");
  console.log("║     🧪 BodiX Zalo Test Tool       ║");
  console.log("╚═══════════════════════════════════╝\n");

  while (true) {
    console.log("\n─── Menu ───");
    console.log("  1. Kiểm tra OA info");
    console.log("  2. Lấy danh sách followers");
    console.log("  3. Gửi tin Tư vấn (CS message)");
    console.log("  4. Gửi ZNS OTP template");
    console.log("  5. Kiểm tra token");
    console.log("  6. Refresh token");
    console.log("  0. Thoát\n");

    const choice = (await ask("Chọn (0-6): ")).trim();

    try {
      switch (choice) {
        case "1": await checkOAInfo(); break;
        case "2": await getFollowers(); break;
        case "3": await sendCSMessage(); break;
        case "4": await sendZNSOtp(); break;
        case "5": await checkToken(); break;
        case "6": await refreshToken(); break;
        case "0":
          console.log("\nBye! 👋\n");
          rl.close();
          process.exit(0);
        default:
          console.log("  Chọn 0-6.");
      }
    } catch (err) {
      fail(String(err));
    }
  }
}

main();
