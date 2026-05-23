import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateCheckoutTotal } from "../calculate-total";
import type { ResolvedReward } from "../resolve-reward";

const BASE = 499_000;

const percent10: ResolvedReward = {
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

test("case 1: no code → total = base", () => {
  const r = calculateCheckoutTotal({ basePriceVnd: BASE });
  assert.equal(r.subtotal, BASE);
  assert.equal(r.total, BASE);
  assert.equal(r.discounts.length, 0);
});

test("case 2: referral 10% from DB → total = 449.100", () => {
  const r = calculateCheckoutTotal({ basePriceVnd: BASE, referralReward: percent10 });
  assert.equal(r.subtotal, BASE);
  assert.equal(r.total, 449_100);
  assert.equal(r.discounts.length, 1);
  assert.equal(r.discounts[0].amount, 49_900);
  assert.equal(r.discounts[0].source, "db");
});

test("case 3: referral fallback constant → total = 449.100 with source=fallback_constant", () => {
  const r = calculateCheckoutTotal({ basePriceVnd: BASE, referralReward: percent10Fallback });
  assert.equal(r.total, 449_100);
  assert.equal(r.discounts[0].source, "fallback_constant");
});

test("case 4: voucher 100K → total = 399.000", () => {
  const r = calculateCheckoutTotal({ basePriceVnd: BASE, voucherReward: voucher100k });
  assert.equal(r.total, 399_000);
  assert.equal(r.discounts[0].amount, 100_000);
});

test("case 5: referral 10% + voucher 100K → percent first → total = 349.100", () => {
  const r = calculateCheckoutTotal({
    basePriceVnd: BASE,
    referralReward: percent10,
    voucherReward: voucher100k,
  });
  assert.equal(r.total, 349_100);
  assert.equal(r.discounts.length, 2);
  assert.equal(r.discounts[0].kind, "referral");
  assert.equal(r.discounts[0].amount, 49_900);
  assert.equal(r.discounts[1].kind, "voucher");
  assert.equal(r.discounts[1].amount, 100_000);
});

test("case 6: voucher 600K exceeds subtotal → total = 0, voucher capped", () => {
  const r = calculateCheckoutTotal({ basePriceVnd: BASE, voucherReward: voucher600k });
  assert.equal(r.total, 0);
  assert.equal(r.discounts[0].amount, BASE);
});

test("case 7: no reward → returns subtotal even with falsy rewards", () => {
  const r = calculateCheckoutTotal({
    basePriceVnd: BASE,
    referralReward: { type: "none", value: 0, source: "none", label: "" },
    voucherReward: { type: "none", value: 0, source: "none", label: "" },
  });
  assert.equal(r.total, BASE);
  assert.equal(r.discounts.length, 0);
});

test("clamps negative base to 0", () => {
  const r = calculateCheckoutTotal({ basePriceVnd: -1000 });
  assert.equal(r.subtotal, 0);
  assert.equal(r.total, 0);
});

test("integer rounding: 1234 × 10% = 123 (Math.round)", () => {
  const r = calculateCheckoutTotal({ basePriceVnd: 1234, referralReward: percent10 });
  assert.equal(r.total, Math.round(1234 * 0.9));
  assert.equal(r.discounts[0].amount, 1234 - r.total);
});

test("affiliate percent stacks with voucher (same precedence as referral)", () => {
  const aff: ResolvedReward = {
    type: "percent",
    value: 10,
    source: "db",
    label: "Giảm 10% từ đối tác Tâm",
  };
  const r = calculateCheckoutTotal({
    basePriceVnd: BASE,
    affiliateReward: aff,
    voucherReward: voucher100k,
  });
  assert.equal(r.total, 349_100);
});

test("multi-program: bodix-6w (1.990.000) with 10% + 100K → total = 1.691.000", () => {
  const r = calculateCheckoutTotal({
    basePriceVnd: 1_990_000,
    referralReward: percent10,
    voucherReward: voucher100k,
  });
  assert.equal(r.total, Math.round(1_990_000 * 0.9) - 100_000);
});

test("multi-program: bodix-12w (3.490.000) with 10% + 100K → total computed correctly", () => {
  const r = calculateCheckoutTotal({
    basePriceVnd: 3_490_000,
    referralReward: percent10,
    voucherReward: voucher100k,
  });
  assert.equal(r.total, Math.round(3_490_000 * 0.9) - 100_000);
});
