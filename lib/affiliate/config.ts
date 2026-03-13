/**
 * Centralized affiliate & referral configuration.
 * Import from here instead of hardcoding values in API routes.
 */

// ---------------------------------------------------------------------------
// Affiliate commission tiers
// ---------------------------------------------------------------------------

/** Commission rate (%) by affiliate tier */
export const TIER_COMMISSION: Record<string, number> = {
  basic: 40,    // first 6 months
  silver: 30,   // months 7-12
  gold: 25,     // year 2+
  platinum: 25, // legacy / custom deals
};

/** Default commission rate for new affiliates */
export const DEFAULT_COMMISSION_RATE = TIER_COMMISSION.basic; // 40%

// ---------------------------------------------------------------------------
// Referral rewards
// ---------------------------------------------------------------------------

/** Credit (VND) awarded to the referrer per successful conversion */
export const REFERRAL_REWARD_AMOUNT = 100_000;

/** Discount (%) given to the referred user on their first purchase */
export const REFERRAL_DISCOUNT_PERCENT = 10;
