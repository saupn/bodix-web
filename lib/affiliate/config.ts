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

/** Discount (%) given to the referred user on their first purchase (referral) */
export const REFERRAL_DISCOUNT_PERCENT = 10;

/** Discount (%) given to the referred user via affiliate link */
export const AFFILIATE_DISCOUNT_PERCENT = 10;

// ---------------------------------------------------------------------------
// Voucher settings
// ---------------------------------------------------------------------------

/**
 * Voucher expiry days — single source of truth is REFERRAL_VOUCHER_EXPIRY_DAYS
 * trong lib/referral/commission.ts. Voucher chỉ được tạo bởi cron rescue-check
 * khi commission V2 transition pending → payable.
 */

// ---------------------------------------------------------------------------
// Payout settings
// ---------------------------------------------------------------------------

/** Minimum affiliate payout amount (VND) */
export const MIN_PAYOUT_AMOUNT = 500_000;

/** Alias matching task spec naming. */
export const AFFILIATE_MIN_WITHDRAW_VND = MIN_PAYOUT_AMOUNT;

// ---------------------------------------------------------------------------
// Commission V2 (cooldown) settings
// ---------------------------------------------------------------------------

/** Default commission rate (%) for affiliate cash commission. */
export const AFFILIATE_COMMISSION_RATE = DEFAULT_COMMISSION_RATE;

/**
 * Số ngày tối đa commission ở trạng thái 'pending' trước khi auto-cancel.
 * Đếm từ purchase_at. KHÔNG đếm nếu referee đang ở 'paid_waiting_cohort'
 * (cohort chưa start không phải lỗi của họ).
 */
export const AFFILIATE_PENDING_TIMEOUT_DAYS = 60;

/**
 * Số ngày tối đa referee ở 'active' mà chưa check-in trước khi auto-cancel.
 * Đếm từ enrollment.started_at.
 */
export const AFFILIATE_NO_CHECKIN_TIMEOUT_DAYS = 14;

/**
 * Số conversion trong 7 ngày qua trên một affiliate để flag suspicious.
 */
export const AFFILIATE_SUSPICIOUS_THRESHOLD = 10;
