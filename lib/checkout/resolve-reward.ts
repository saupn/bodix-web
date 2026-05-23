import {
  REFERRAL_DISCOUNT_PERCENT,
  AFFILIATE_DISCOUNT_PERCENT,
} from "@/lib/affiliate/config";

export type RewardType = "percent" | "fixed" | "none";
export type RewardSource = "db" | "fallback_constant" | "none";

export interface ResolvedReward {
  type: RewardType;
  value: number;
  source: RewardSource;
  label: string;
}

export const NO_REWARD: ResolvedReward = {
  type: "none",
  value: 0,
  source: "none",
  label: "",
};

export interface ReferralCodeRow {
  id: string | null;
  code: string;
  code_type: "referral" | "affiliate" | null;
  referee_reward_type: string | null;
  referee_reward_value: number | null;
  referrer_name?: string | null;
}

export interface VoucherRow {
  id: string;
  code: string;
  remaining_amount: number;
}

// ─── Masking helper ──────────────────────────────────────────────────────────
// Show 4 leading chars + "***" so log readers can still cluster events without
// the full code leaking (a leaked active referral code = free 10% for anyone).
export function maskCode(code: string | null | undefined): string {
  const trimmed = (code ?? "").trim();
  if (trimmed.length === 0) return "<empty>";
  if (trimmed.length <= 4) return trimmed[0] + "***";
  return trimmed.slice(0, 4) + "***";
}

// ─── Fire-and-forget fallback log ────────────────────────────────────────────
// Always runs server-side. We intentionally do NOT await so checkout latency
// stays unchanged. Errors are swallowed.

interface FallbackLogContext {
  codeType: "referral" | "affiliate" | "voucher";
  codeId: string | null;
  code: string | null;
  missingFields: string[];
  fallbackType: RewardType;
  fallbackValue: number;
  userId?: string;
  programSlug?: string;
}

function logFallbackEvent(ctx: FallbackLogContext): void {
  const masked = maskCode(ctx.code);
  // Always emit a structured warning so Vercel logs surface it even if the
  // DB insert below fails (no Sentry installed in this project yet).
  console.warn(
    JSON.stringify({
      event: "discount_fallback_triggered",
      severity: "warning",
      code_type: ctx.codeType,
      code: masked,
      code_id: ctx.codeId,
      missing_fields: ctx.missingFields,
      fallback_type: ctx.fallbackType,
      fallback_value: ctx.fallbackValue,
      user_id: ctx.userId ?? null,
      program_slug: ctx.programSlug ?? null,
      timestamp: new Date().toISOString(),
    }),
  );

  // Fire-and-forget DB insert. Lazy require so this module stays importable
  // from environments without the Supabase service client (e.g. unit tests).
  void (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = await import("@/lib/supabase/service");
      const service = mod.createServiceClient();
      await service.from("discount_fallback_log").insert({
        code_type: ctx.codeType,
        code_id: ctx.codeId,
        code_masked: masked,
        missing_fields: ctx.missingFields,
        fallback_type: ctx.fallbackType,
        fallback_value: ctx.fallbackValue,
        user_id: ctx.userId ?? null,
        program_slug: ctx.programSlug ?? null,
      });
    } catch (err) {
      // Never break checkout because of monitoring failure.
      console.warn(
        JSON.stringify({
          event: "discount_fallback_log_insert_failed",
          severity: "warning",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  })();
}

// ─── Label builders ──────────────────────────────────────────────────────────
function buildReferralLabel(referrerName: string | null | undefined, percent: number): string {
  const name = referrerName?.trim();
  return name
    ? `Giảm ${percent}% từ ${name}`
    : `Giảm ${percent}% từ mã giới thiệu`;
}

function buildAffiliateLabel(referrerName: string | null | undefined, percent: number): string {
  const name = referrerName?.trim();
  return name
    ? `Giảm ${percent}% từ đối tác ${name}`
    : `Giảm ${percent}% từ đối tác`;
}

// ─── Resolvers ───────────────────────────────────────────────────────────────

export function resolveReferralReward(
  row: ReferralCodeRow | null,
): ResolvedReward {
  if (!row) return NO_REWARD;

  const codeType: "referral" | "affiliate" = row.code_type ?? "referral";
  const labelFn = codeType === "affiliate" ? buildAffiliateLabel : buildReferralLabel;

  if (row.referee_reward_type === "discount_percent" && row.referee_reward_value && row.referee_reward_value > 0) {
    return {
      type: "percent",
      value: row.referee_reward_value,
      source: "db",
      label: labelFn(row.referrer_name, row.referee_reward_value),
    };
  }

  if (row.referee_reward_type === "discount_fixed" && row.referee_reward_value && row.referee_reward_value > 0) {
    return {
      type: "fixed",
      value: row.referee_reward_value,
      source: "db",
      label: labelFn(row.referrer_name, row.referee_reward_value),
    };
  }

  if (row.referee_reward_type && row.referee_reward_type !== "discount_percent" && row.referee_reward_type !== "discount_fixed") {
    // Explicit non-discount reward type (e.g. free_days, credit) — no checkout discount.
    return NO_REWARD;
  }

  // Fallback branch: row exists & is valid but missing reward fields.
  const missingFields: string[] = [];
  if (!row.referee_reward_type) missingFields.push("referee_reward_type");
  if (!row.referee_reward_value || row.referee_reward_value <= 0) missingFields.push("referee_reward_value");
  const pct = codeType === "affiliate" ? AFFILIATE_DISCOUNT_PERCENT : REFERRAL_DISCOUNT_PERCENT;

  logFallbackEvent({
    codeType,
    codeId: row.id,
    code: row.code,
    missingFields,
    fallbackType: "percent",
    fallbackValue: pct,
  });

  return {
    type: "percent",
    value: pct,
    source: "fallback_constant",
    label: labelFn(row.referrer_name, pct),
  };
}

export function resolveAffiliateReward(row: ReferralCodeRow | null): ResolvedReward {
  if (!row) return NO_REWARD;
  return resolveReferralReward({ ...row, code_type: "affiliate" });
}

export function resolveVoucherReward(row: VoucherRow | null): ResolvedReward {
  if (!row || row.remaining_amount <= 0) return NO_REWARD;
  return {
    type: "fixed",
    value: row.remaining_amount,
    source: "db",
    label: `Voucher ${row.code}`,
  };
}
