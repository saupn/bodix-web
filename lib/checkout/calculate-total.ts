import type { ResolvedReward } from "./resolve-reward";

export interface DiscountLine {
  label: string;
  amount: number;
  source: ResolvedReward["source"];
  kind: "referral" | "affiliate" | "voucher";
}

export interface CheckoutBreakdown {
  subtotal: number;
  discounts: DiscountLine[];
  total: number;
}

export interface CalculateCheckoutTotalInput {
  basePriceVnd: number;
  referralReward?: ResolvedReward;
  affiliateReward?: ResolvedReward;
  voucherReward?: ResolvedReward;
}

function applyReward(
  running: number,
  reward: ResolvedReward | undefined,
  kind: DiscountLine["kind"],
  fallbackLabel: string,
): { running: number; line: DiscountLine | null } {
  if (!reward || reward.type === "none" || reward.value <= 0) {
    return { running, line: null };
  }
  const before = running;
  if (reward.type === "percent") {
    const after = Math.round(before * (1 - reward.value / 100));
    return {
      running: Math.max(0, after),
      line: {
        label: reward.label || fallbackLabel,
        amount: before - Math.max(0, after),
        source: reward.source,
        kind,
      },
    };
  }
  // fixed
  const take = Math.min(reward.value, before);
  return {
    running: before - take,
    line: {
      label: reward.label || fallbackLabel,
      amount: take,
      source: reward.source,
      kind,
    },
  };
}

export function calculateCheckoutTotal(
  input: CalculateCheckoutTotalInput,
): CheckoutBreakdown {
  const subtotal = Math.max(0, Math.round(input.basePriceVnd));
  const discounts: DiscountLine[] = [];
  let running = subtotal;

  for (const step of [
    { reward: input.referralReward, kind: "referral" as const, label: "Giảm giá giới thiệu" },
    { reward: input.affiliateReward, kind: "affiliate" as const, label: "Giảm giá đối tác" },
    { reward: input.voucherReward, kind: "voucher" as const, label: "Voucher" },
  ]) {
    const result = applyReward(running, step.reward, step.kind, step.label);
    running = result.running;
    if (result.line) discounts.push(result.line);
  }

  const total = Math.max(0, Math.round(running));
  return { subtotal, discounts, total };
}

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(amount))) + " đ";
}
