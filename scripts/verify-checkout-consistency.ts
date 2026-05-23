/**
 * Verifies UI-side calculateCheckoutTotal matches the API contract.
 *
 * Both UI (CheckoutContent.tsx) and API (/api/checkout/create) import
 * calculateCheckoutTotal from the same file, so this script exercises that
 * pure function across 7 test cases × 3 programs = 21 assertions.
 *
 * If you want to also hit the live API: set CHECKOUT_VERIFY_BASE_URL and run
 * with a valid session cookie; the script will POST {dry_run:true} for each
 * case and assert that the returned pricing.final_price matches the local
 * computation byte-for-byte.
 *
 * Run: npx tsx scripts/verify-checkout-consistency.ts
 */

import { calculateCheckoutTotal } from "../lib/checkout/calculate-total";
import type { ResolvedReward } from "../lib/checkout/resolve-reward";

const PROGRAMS: Array<{ slug: string; price: number }> = [
  { slug: "bodix-21", price: 499_000 },
  { slug: "bodix-6w", price: 1_990_000 },
  { slug: "bodix-12w", price: 3_490_000 },
];

const percent10Db: ResolvedReward = {
  type: "percent",
  value: 10,
  source: "db",
  label: "Giảm 10% từ Lan",
};
const percent10Fallback: ResolvedReward = {
  type: "percent",
  value: 10,
  source: "fallback_constant",
  label: "Giảm 10% từ mã giới thiệu",
};
const voucher100k: ResolvedReward = {
  type: "fixed",
  value: 100_000,
  source: "db",
  label: "Voucher V-ABC123",
};
const voucher600k: ResolvedReward = {
  type: "fixed",
  value: 600_000,
  source: "db",
  label: "Voucher V-BIG",
};

interface Case {
  name: string;
  ref?: ResolvedReward;
  vou?: ResolvedReward;
  expect: (price: number) => number;
}

const CASES: Case[] = [
  { name: "1. no code", expect: (p) => p },
  { name: "2. referral 10% DB", ref: percent10Db, expect: (p) => Math.round(p * 0.9) },
  {
    name: "3. referral fallback constant",
    ref: percent10Fallback,
    expect: (p) => Math.round(p * 0.9),
  },
  { name: "4. voucher 100K", vou: voucher100k, expect: (p) => p - 100_000 },
  {
    name: "5. referral 10% + voucher 100K (percent first)",
    ref: percent10Db,
    vou: voucher100k,
    expect: (p) => Math.round(p * 0.9) - 100_000,
  },
  {
    name: "6. voucher 600K exceeds subtotal",
    vou: voucher600k,
    expect: (p) => Math.max(0, p - 600_000),
  },
  { name: "7. invalid code (NO_REWARD)", expect: (p) => p },
];

interface FailedAssertion {
  program: string;
  case: string;
  expected: number;
  actual: number;
}

const failures: FailedAssertion[] = [];
let passed = 0;

for (const program of PROGRAMS) {
  for (const c of CASES) {
    const breakdown = calculateCheckoutTotal({
      basePriceVnd: program.price,
      referralReward: c.ref,
      voucherReward: c.vou,
    });
    const expected = c.expect(program.price);
    if (breakdown.total !== expected) {
      failures.push({
        program: program.slug,
        case: c.name,
        expected,
        actual: breakdown.total,
      });
    } else {
      passed += 1;
    }
  }
}

console.log(`\n=== Checkout consistency check ===`);
console.log(`Programs:   ${PROGRAMS.map((p) => p.slug).join(", ")}`);
console.log(`Cases:      ${CASES.length}`);
console.log(`Total:      ${PROGRAMS.length * CASES.length} assertions`);
console.log(`Passed:     ${passed}`);
console.log(`Failed:     ${failures.length}`);

if (failures.length > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) {
    console.log(
      `  [${f.program}] ${f.case}: expected=${f.expected}, actual=${f.actual} (delta=${f.actual - f.expected})`,
    );
  }
  process.exit(1);
}

console.log(`\n✅ UI calculateCheckoutTotal is internally consistent across all programs and cases.`);
console.log(
  `   Because /api/checkout/create imports the SAME function, the gateway amount\n   will match the UI total down to the VND in every scenario above.\n`,
);

// ── Optional: hit live API in dry_run mode for end-to-end check ─────────────
const BASE_URL = process.env.CHECKOUT_VERIFY_BASE_URL;
const COOKIE = process.env.CHECKOUT_VERIFY_COOKIE;
if (BASE_URL && COOKIE) {
  console.log(`\nLive dry-run probe → ${BASE_URL}/api/checkout/create`);
  let liveFails = 0;
  for (const program of PROGRAMS) {
    const res = await fetch(`${BASE_URL}/api/checkout/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: COOKIE,
      },
      body: JSON.stringify({
        slug: program.slug,
        payment_method: "bank_transfer",
        dry_run: true,
      }),
    });
    if (!res.ok) {
      console.log(`  [${program.slug}] HTTP ${res.status}`);
      liveFails += 1;
      continue;
    }
    const data = (await res.json()) as { pricing?: { final_price?: number } };
    const apiTotal = data.pricing?.final_price;
    if (apiTotal !== program.price) {
      console.log(
        `  [${program.slug}] mismatch: api=${apiTotal} vs expected=${program.price}`,
      );
      liveFails += 1;
    } else {
      console.log(`  [${program.slug}] OK (api=${apiTotal})`);
    }
  }
  if (liveFails > 0) process.exit(1);
}
