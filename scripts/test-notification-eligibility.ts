/**
 * scripts/test-notification-eligibility.ts
 *
 * End-to-end test cho getEligibleForNudge().
 *
 * Tạo test enrollment ở mọi trạng thái:
 *   - active                                                 → eligible (bucket=active)
 *   - trial (trial_ends_at = today + 1 day)                  → eligible (bucket=trial)
 *   - trial (trial_ends_at = today, đúng ngày)               → eligible (so sánh >=)
 *   - trial (trial_ends_at = yesterday)                      → NOT eligible
 *   - trial (trial_ends_at = NULL)                           → NOT eligible (an toàn)
 *   - pending_payment (trial_ends_at = tomorrow)             → eligible (paid in-trial)
 *   - paid_waiting_cohort (trial_ends_at = tomorrow)         → eligible (paid in-trial)
 *   - pending_payment (trial_ends_at = NULL)                 → NOT eligible
 *   - paid_waiting_cohort (trial_ends_at = NULL)             → NOT eligible
 *   - trial_completed                                        → NOT eligible
 *   - completed                                              → NOT eligible
 *   - dropped                                                → NOT eligible
 *   - paused                                                 → NOT eligible
 *
 * Chạy: npx tsx scripts/test-notification-eligibility.ts
 *
 * Yêu cầu .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * CẢNH BÁO: Script tạo auth users + enrollment thật trong DB. Tự cleanup sau khi
 * chạy xong (success hoặc fail). Email prefix "test-eligibility-..." để dễ
 * detect orphan rows nếu cleanup lỗi.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// Set env BEFORE importing helper (helper reads at module-init time).
process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_KEY;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getEligibleForNudge } = await import(
  "../lib/notifications/eligible-enrollments.ts"
);

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_PREFIX = `test-eligibility-${Date.now()}`;

// ─── Date helpers (VN timezone) ─────────────────────────────────────────────

function getVietnamYmd(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

function addDaysIso(daysDelta: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysDelta);
  return d.toISOString();
}

// ─── Test scenario type ─────────────────────────────────────────────────────

interface Scenario {
  label: string;
  status: string;
  trialEndsAt: string | null;
  expectedEligible: boolean;
  userId?: string;
  enrollmentId?: string;
}

const SCENARIOS: Scenario[] = [
  { label: "active", status: "active", trialEndsAt: null, expectedEligible: true },
  { label: "trial-tomorrow", status: "trial", trialEndsAt: addDaysIso(1), expectedEligible: true },
  { label: "trial-today", status: "trial", trialEndsAt: addDaysIso(0), expectedEligible: true },
  { label: "trial-yesterday", status: "trial", trialEndsAt: addDaysIso(-1), expectedEligible: false },
  { label: "trial-null-end", status: "trial", trialEndsAt: null, expectedEligible: false },
  { label: "trial_completed", status: "trial_completed", trialEndsAt: addDaysIso(-3), expectedEligible: false },
  // Paid in-trial: user thanh toán trong khi vẫn còn hạn trial → vẫn cần morning/evening reminder
  { label: "pending_payment-in-trial", status: "pending_payment", trialEndsAt: addDaysIso(1), expectedEligible: true },
  { label: "paid_waiting_cohort-in-trial", status: "paid_waiting_cohort", trialEndsAt: addDaysIso(1), expectedEligible: true },
  // Paid after-trial: trial_ends_at NULL hoặc đã qua → KHÔNG còn ở giai đoạn trial
  { label: "pending_payment-null-end", status: "pending_payment", trialEndsAt: null, expectedEligible: false },
  { label: "paid_waiting_cohort-null-end", status: "paid_waiting_cohort", trialEndsAt: null, expectedEligible: false },
  { label: "completed", status: "completed", trialEndsAt: null, expectedEligible: false },
  { label: "dropped", status: "dropped", trialEndsAt: null, expectedEligible: false },
  { label: "paused", status: "paused", trialEndsAt: null, expectedEligible: false },
];

// ─── Setup / Teardown ───────────────────────────────────────────────────────

async function getProgramId(): Promise<string> {
  const { data, error } = await admin
    .from("programs")
    .select("id")
    .eq("slug", "bodix-21")
    .single();
  if (error || !data) throw new Error(`Cannot find program bodix-21: ${error?.message}`);
  return data.id;
}

async function setupScenario(s: Scenario, programId: string): Promise<void> {
  const email = `${TEST_PREFIX}-${s.label}@bodix-test.invalid`;

  // 1. Create auth user (trigger auto-creates profile row)
  const { data: userData, error: userErr } = await admin.auth.admin.createUser({
    email,
    password: "TestPassword!" + Math.random().toString(36).slice(2),
    email_confirm: true,
    user_metadata: { test_marker: TEST_PREFIX, scenario: s.label },
  });
  if (userErr || !userData.user) {
    throw new Error(`createUser failed for ${s.label}: ${userErr?.message}`);
  }
  s.userId = userData.user.id;

  // 2. Update profile (set trial_ends_at, channel_user_id so it has a channel)
  const { error: profErr } = await admin
    .from("profiles")
    .update({
      full_name: `Test ${s.label}`,
      trial_ends_at: s.trialEndsAt,
      channel_user_id: `test-zalo-uid-${s.label}`,
    })
    .eq("id", s.userId);
  if (profErr) throw new Error(`profile update failed for ${s.label}: ${profErr.message}`);

  // 3. Create enrollment
  const { data: enr, error: enrErr } = await admin
    .from("enrollments")
    .insert({
      user_id: s.userId,
      program_id: programId,
      status: s.status,
      enrolled_at: addDaysIso(-1),
      started_at: addDaysIso(-1),
      current_day: 1,
    })
    .select("id")
    .single();
  if (enrErr || !enr) throw new Error(`enrollment insert failed for ${s.label}: ${enrErr?.message}`);
  s.enrollmentId = enr.id;
}

async function teardownScenario(s: Scenario): Promise<void> {
  if (s.enrollmentId) {
    await admin.from("enrollments").delete().eq("id", s.enrollmentId);
  }
  if (s.userId) {
    // profiles cascades from auth.users on delete
    await admin.auth.admin.deleteUser(s.userId);
  }
}

// ─── Assertions ─────────────────────────────────────────────────────────────

interface AssertResult {
  scenario: string;
  expected: boolean;
  morningActual: boolean;
  eveningActual: boolean;
  passed: boolean;
  note?: string;
}

async function runAssertions(programId: string): Promise<AssertResult[]> {
  const todayVN = getVietnamYmd();
  console.log(`\n── Running getEligibleForNudge for todayVN=${todayVN} ──\n`);

  const { enrollments: morningElig, breakdown: morningBd } = await getEligibleForNudge(
    "morning",
    todayVN,
    programId,
  );
  const { enrollments: eveningElig, breakdown: eveningBd } = await getEligibleForNudge(
    "evening",
    todayVN,
    programId,
  );

  console.log("morning breakdown:", JSON.stringify(morningBd));
  console.log("evening breakdown:", JSON.stringify(eveningBd));

  const morningUserIds = new Set(morningElig.map(e => e.user_id));
  const eveningUserIds = new Set(eveningElig.map(e => e.user_id));

  const results: AssertResult[] = [];

  for (const s of SCENARIOS) {
    if (!s.userId) continue;
    const morningActual = morningUserIds.has(s.userId);
    const eveningActual = eveningUserIds.has(s.userId);
    const consistent = morningActual === eveningActual;
    const correct = morningActual === s.expectedEligible && eveningActual === s.expectedEligible;
    results.push({
      scenario: s.label,
      expected: s.expectedEligible,
      morningActual,
      eveningActual,
      passed: correct && consistent,
      note: !consistent
        ? "morning/evening DISAGREE — helper is split!"
        : !correct
        ? `expected eligible=${s.expectedEligible}, got morning=${morningActual} evening=${eveningActual}`
        : undefined,
    });
  }

  return results;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  notification-eligibility integration test   ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`Test prefix: ${TEST_PREFIX}`);
  console.log(`Project:     ${SUPABASE_URL}\n`);

  let programId: string;
  try {
    programId = await getProgramId();
    console.log(`✓ Found program bodix-21 (${programId})\n`);
  } catch (err) {
    console.error("❌", err);
    process.exit(1);
  }

  let setupOk = 0;
  let setupFail = 0;
  for (const s of SCENARIOS) {
    try {
      await setupScenario(s, programId);
      console.log(`  ✓ setup ${s.label} (user=${s.userId?.slice(0, 8)})`);
      setupOk++;
    } catch (err) {
      console.error(`  ✗ setup ${s.label}:`, err instanceof Error ? err.message : err);
      setupFail++;
    }
  }
  console.log(`\nSetup done: ${setupOk} ok, ${setupFail} failed.\n`);

  let allPassed = false;
  let results: AssertResult[] = [];
  try {
    results = await runAssertions(programId);

    console.log("\n── Assertions ──\n");
    const padded = (s: string, n: number) => s.padEnd(n);
    console.log(
      padded("Scenario", 28),
      padded("Expected", 10),
      padded("Morning", 9),
      padded("Evening", 9),
      "Result",
    );
    console.log("─".repeat(75));

    for (const r of results) {
      console.log(
        padded(r.scenario, 28),
        padded(String(r.expected), 10),
        padded(String(r.morningActual), 9),
        padded(String(r.eveningActual), 9),
        r.passed ? "✓ PASS" : `✗ FAIL — ${r.note ?? ""}`,
      );
    }

    allPassed = results.every(r => r.passed);
    console.log("\n" + (allPassed ? "🎉 All assertions passed!" : "⚠️  Some assertions FAILED"));
  } catch (err) {
    console.error("\n❌ Assertion run threw:", err);
  }

  console.log("\n── Cleanup ──");
  let cleanOk = 0;
  let cleanFail = 0;
  for (const s of SCENARIOS) {
    try {
      await teardownScenario(s);
      cleanOk++;
    } catch (err) {
      console.error(`  ✗ cleanup ${s.label}:`, err instanceof Error ? err.message : err);
      cleanFail++;
    }
  }
  console.log(`Cleanup: ${cleanOk} ok, ${cleanFail} failed.`);

  if (cleanFail > 0) {
    console.warn(
      `\n⚠️  Orphan test rows may remain. Manual cleanup: \n` +
        `   DELETE FROM auth.users WHERE email LIKE '${TEST_PREFIX}%';`,
    );
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error("\n💥 Unhandled error:", err);
  process.exit(2);
});
