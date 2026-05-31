import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRiskScore, computeRiskBand, type RiskInput } from "../risk";

function input(p: Partial<RiskInput>): RiskInput {
  return {
    consecutiveMissed: 0,
    feeling: null,
    lastNudgeLedToCheckin: null,
    lowFeelingTrend: false,
    ...p,
  };
}

// ── Bỏ buổi 1 / 2 / 3 ngày ──────────────────────────────────────────────────
test("miss 1 day → score 25, band low", () => {
  const i = input({ consecutiveMissed: 1 });
  assert.equal(computeRiskScore(i), 25);
  assert.equal(computeRiskBand(i), "low"); // medium-subset = 25 < 30
});

test("miss 2 days → score 50, band medium", () => {
  const i = input({ consecutiveMissed: 2 });
  assert.equal(computeRiskScore(i), 50);
  assert.equal(computeRiskBand(i), "medium"); // subset 50 >= 30, full 50 < 60
});

test("miss 3 days → score 75, band high", () => {
  const i = input({ consecutiveMissed: 3 });
  assert.equal(computeRiskScore(i), 75);
  assert.equal(computeRiskBand(i), "high"); // full 75 >= 60
});

test("miss 5 days (>=3 same as 3) → score 75, high", () => {
  const i = input({ consecutiveMissed: 5 });
  assert.equal(computeRiskScore(i), 75);
  assert.equal(computeRiskBand(i), "high");
});

// ── Feeling thấp HÔM NAY ─────────────────────────────────────────────────────
test("feeling 2 today only (no miss) → score 15, band low", () => {
  const i = input({ feeling: 2 });
  assert.equal(computeRiskScore(i), 15);
  assert.equal(computeRiskBand(i), "low"); // subset 15 < 30
});

test("feeling 3 (>2) contributes nothing", () => {
  const i = input({ feeling: 3 });
  assert.equal(computeRiskScore(i), 0);
  assert.equal(computeRiskBand(i), "low");
});

test("miss 1 + feeling 2 today → score 40, band medium", () => {
  const i = input({ consecutiveMissed: 1, feeling: 2 });
  assert.equal(computeRiskScore(i), 40);
  assert.equal(computeRiskBand(i), "medium"); // subset 25+15=40 >= 30
});

// ── low_feeling_trend (063: +15, thay cho mode-light +5 đã bỏ) ───────────────
test("low_feeling_trend alone → score 15, band low", () => {
  const i = input({ lowFeelingTrend: true });
  assert.equal(computeRiskScore(i), 15);
  assert.equal(computeRiskBand(i), "low"); // không vào medium-subset
});

test("today feeling 2 + low_feeling_trend → score 30 (15+15)", () => {
  const i = input({ feeling: 2, lowFeelingTrend: true });
  assert.equal(computeRiskScore(i), 30);
  assert.equal(computeRiskBand(i), "low"); // subset chỉ đếm feeling hôm nay = 15 < 30
});

// ── 063: mode-light KHÔNG còn cộng điểm (downgrade không thổi điểm) ──────────
test("downgrade-only proxy: no miss, ok feeling, no trend → score 0 (mode-light bỏ +5)", () => {
  // Trước 063: case "light hôm nay" cộng +5. Sau 063: 0.
  const i = input({ consecutiveMissed: 0, feeling: 4, lowFeelingTrend: false });
  assert.equal(computeRiskScore(i), 0);
  assert.equal(computeRiskBand(i), "low");
});

// ── Nudge không dẫn tới check-in ────────────────────────────────────────────
test("nudge led_to_checkin=false adds 10; null/true add 0", () => {
  assert.equal(computeRiskScore(input({ lastNudgeLedToCheckin: false })), 10);
  assert.equal(computeRiskScore(input({ lastNudgeLedToCheckin: null })), 0);
  assert.equal(computeRiskScore(input({ lastNudgeLedToCheckin: true })), 0);
});

test("quirk: nudge false + miss 1 → score 35 but band low (nudge not in medium subset)", () => {
  const i = input({ consecutiveMissed: 1, lastNudgeLedToCheckin: false });
  assert.equal(computeRiskScore(i), 35);
  assert.equal(computeRiskBand(i), "low"); // subset = 25 only < 30
});

// ── Kết hợp & cap ───────────────────────────────────────────────────────────
test("miss 2 + feeling 1 today + low_trend + nudge false → score 90, band high", () => {
  const i = input({ consecutiveMissed: 2, feeling: 1, lowFeelingTrend: true, lastNudgeLedToCheckin: false });
  assert.equal(computeRiskScore(i), 90); // 25+25+15+15+10
  assert.equal(computeRiskBand(i), "high"); // full 90 >= 60
});

test("everything maxed → capped at 100, band high", () => {
  const i = input({ consecutiveMissed: 3, feeling: 1, lowFeelingTrend: true, lastNudgeLedToCheckin: false });
  assert.equal(computeRiskScore(i), 100); // raw 25+25+25+15+10+15=115 capped
  assert.equal(computeRiskBand(i), "high");
});

test("healthy: checked in, feeling 5, no trend, nudge true → score 0, band low", () => {
  const i = input({ consecutiveMissed: 0, feeling: 5, lowFeelingTrend: false, lastNudgeLedToCheckin: true });
  assert.equal(computeRiskScore(i), 0);
  assert.equal(computeRiskBand(i), "low");
});
