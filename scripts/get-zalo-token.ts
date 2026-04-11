/**
 * OAuth flow với server localhost — mở trình duyệt tự động.
 *
 * Cần trong Zalo Developer Console: Redirect URI = http://localhost:3456/callback
 *
 * Usage: npx tsx scripts/get-zalo-token.ts
 *
 * Requires .env.local: ZALO_APP_ID, ZALO_APP_SECRET
 */

import http from "http";
import open from "open";
import { config } from "dotenv";

config({ path: ".env.local" });

const APP_ID = process.env.ZALO_APP_ID;
const APP_SECRET = process.env.ZALO_APP_SECRET;
const CALLBACK_URL = "http://localhost:3456/callback";

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

async function getZaloToken(): Promise<void> {
  console.log("🔑 Bắt đầu lấy Zalo Access Token...\n");

  if (!APP_ID || !APP_SECRET) {
    console.error("Thiếu ZALO_APP_ID hoặc ZALO_APP_SECRET trong .env.local");
    process.exit(1);
  }

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>❌ Bad request</h1>");
        return;
      }

      const url = new URL(req.url, `http://localhost:3456`);
      const authCode = url.searchParams.get("code");

      if (authCode) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          "<h1>✅ Đã nhận Authorization Code!</h1><p>Quay lại terminal.</p>"
        );
        server.close(() => resolve(authCode));
      } else {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>❌ Không có code</h1>");
      }
    });

    server.on("error", reject);

    server.listen(3456, () => {
      console.log("📡 Server tạm đang chạy tại http://localhost:3456");
      console.log("🌐 Mở trình duyệt để cấp quyền...\n");

      const authUrl = `https://oauth.zaloapp.com/v4/oa/permission?app_id=${APP_ID}&redirect_uri=${encodeURIComponent(CALLBACK_URL)}`;
      void open(authUrl);
    });
  });

  console.log(`✅ Authorization Code: ${code.substring(0, 20)}...`);
  console.log("🔄 Đổi code lấy Access Token...\n");

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
    console.log("✅ Lấy token thành công!\n");
    console.log("Access Token:", `${at.substring(0, 30)}...`);
    console.log("Refresh Token:", `${rt.substring(0, 30)}...`);
    console.log("Expires in:", data.expires_in, "giây\n");

    console.log("📋 Copy SQL sau vào Supabase SQL Editor:\n");
    console.log(`INSERT INTO zalo_tokens (id, access_token, refresh_token, expires_at)
VALUES (
  1,
  '${escapeSqlLiteral(at)}',
  '${escapeSqlLiteral(rt)}',
  now() + interval '25 hours'
)
ON CONFLICT (id) DO UPDATE SET
  access_token = EXCLUDED.access_token,
  refresh_token = EXCLUDED.refresh_token,
  expires_at = EXCLUDED.expires_at,
  updated_at = now();`);
  } else {
    console.error("❌ Lỗi:", JSON.stringify(data, null, 2));
    process.exit(1);
  }
}

getZaloToken().catch((err) => {
  console.error(err);
  process.exit(1);
});
