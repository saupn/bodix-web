/**
 * Đổi Authorization Code lấy token — không mở browser, không cần package `open`.
 *
 * Redirect URI production (Zalo App): https://bodix.fit/api/zalo/callback
 *
 * Usage:
 *   npx tsx scripts/get-zalo-token-simple.ts
 *   npx tsx scripts/get-zalo-token-simple.ts CODE_VUA_COPY
 *
 * Requires .env.local: ZALO_APP_ID, ZALO_APP_SECRET
 */

import { config } from "dotenv";

config({ path: ".env.local" });

const APP_ID = process.env.ZALO_APP_ID;
const APP_SECRET = process.env.ZALO_APP_SECRET;

const REDIRECT_URI = "https://bodix.fit/api/zalo/callback";

type ZaloTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: number;
  message?: string;
};

function escapeSqlLiteral(s: string): string {
  return s.replace(/'/g, "''");
}

const code = process.argv[2];

if (!code) {
  if (!APP_ID) {
    console.error("Thiếu ZALO_APP_ID trong .env.local");
    process.exit(1);
  }
  console.log("Bước 1: Mở link này trong trình duyệt:");
  console.log(
    `https://oauth.zaloapp.com/v4/oa/permission?app_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
  );
  console.log("\nBước 2: Sau khi cấp quyền, copy code từ URL callback");
  console.log(
    "Bước 3: Chạy lại: npx tsx scripts/get-zalo-token-simple.ts CODE_VUA_COPY"
  );
  process.exit(0);
}

if (!APP_ID || !APP_SECRET) {
  console.error("Thiếu ZALO_APP_ID hoặc ZALO_APP_SECRET trong .env.local");
  process.exit(1);
}

async function exchangeToken(): Promise<void> {
  const response = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      secret_key: APP_SECRET,
    },
    body: new URLSearchParams({
      app_id: APP_ID,
      code,
      grant_type: "authorization_code",
    }),
  });

  const data = (await response.json()) as ZaloTokenResponse;

  if (data.access_token) {
    const at = data.access_token;
    const rt = data.refresh_token ?? "";
    console.log("\n✅ Thành công! Copy SQL vào Supabase:\n");
    console.log(`INSERT INTO zalo_tokens (id, access_token, refresh_token, expires_at)
VALUES (1, '${escapeSqlLiteral(at)}', '${escapeSqlLiteral(rt)}', now() + interval '25 hours')
ON CONFLICT (id) DO UPDATE SET
  access_token = EXCLUDED.access_token,
  refresh_token = EXCLUDED.refresh_token,
  expires_at = EXCLUDED.expires_at,
  updated_at = now();`);
  } else {
    console.error("❌ Lỗi:", data);
    process.exit(1);
  }
}

exchangeToken().catch((err) => {
  console.error(err);
  process.exit(1);
});
