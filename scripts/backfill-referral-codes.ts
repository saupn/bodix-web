/**
 * Backfill referral_codes cho user đã onboard nhưng chưa có code.
 *
 * BD-REFERRAL-VOUCHER-FLOW: từ migration 054 trở đi, complete-onboarding
 * tự tạo code. Script này chạy 1 lần để cover user cũ (vd Nguyễn Văn Thành).
 *
 * Usage:
 *   npx tsx scripts/backfill-referral-codes.ts
 *
 * Env required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Idempotent: skip user nào đã có code. An toàn chạy nhiều lần.
 */

import { createClient } from "@supabase/supabase-js";
import { ensureReferralCodeForUser } from "../lib/referral/generate-code";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

async function main() {
  const service = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false },
  });

  // Lấy mọi profile đã onboard (có full_name) — bao gồm cả người đã có code,
  // ensureReferralCodeForUser tự skip nếu đã có.
  const { data: profiles, error } = await service
    .from("profiles")
    .select("id, full_name, referral_code")
    .not("full_name", "is", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch profiles:", error);
    process.exit(1);
  }

  const stats = {
    total: profiles?.length ?? 0,
    skipped_existing: 0,
    created: 0,
    errors: 0,
  };

  for (const p of profiles ?? []) {
    const fullName = (p.full_name ?? "").trim();
    if (!fullName) {
      stats.skipped_existing++;
      continue;
    }
    try {
      const result = await ensureReferralCodeForUser(service, p.id, fullName);
      if (result.created) {
        stats.created++;
        console.log(`[+] ${fullName} → ${result.code}`);
      } else {
        stats.skipped_existing++;
      }
    } catch (err) {
      stats.errors++;
      console.error(`[!] ${fullName} (${p.id}):`, err);
    }
  }

  console.log("\n--- BACKFILL SUMMARY ---");
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
