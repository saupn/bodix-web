/**
 * Single source of truth for referral-program user-facing copy.
 *
 * Bất kỳ trang/component nào hiển thị nội dung về chương trình Giới thiệu phải
 * import từ đây — KHÔNG hardcode 100K, 90 ngày, 10% vào UI.
 */

import {
  REFERRAL_REWARD_AMOUNT,
  REFERRAL_DISCOUNT_PERCENT,
} from "@/lib/affiliate/config";
import {
  REFERRAL_VOUCHER_EXPIRY_DAYS,
} from "@/lib/referral/commission";

function formatVnd(amount: number): string {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

const VOUCHER_VALUE_DISPLAY = formatVnd(REFERRAL_REWARD_AMOUNT);

export const REFERRAL_COPY = {
  // ── Numbers (re-export) ───────────────────────────────────────────────────
  voucherValueVnd: REFERRAL_REWARD_AMOUNT,
  voucherValueDisplay: VOUCHER_VALUE_DISPLAY,
  refereeDiscountPercent: REFERRAL_DISCOUNT_PERCENT,
  refereeDiscountDisplay: `${REFERRAL_DISCOUNT_PERCENT}%`,
  voucherExpireDays: REFERRAL_VOUCHER_EXPIRY_DAYS,

  // ── Tagline ngắn ──────────────────────────────────────────────────────────
  shortTagline:
    `Giới thiệu bạn bè – Nhận voucher ${VOUCHER_VALUE_DISPLAY} khi họ bắt đầu tập`,

  // ── 3 bước nhận voucher ───────────────────────────────────────────────────
  flowSteps: [
    {
      title: "Chia sẻ link của bạn cho bạn bè",
      body: "Mỗi user đều có sẵn mã giới thiệu sau khi đăng ký BodiX.",
    },
    {
      title: `Bạn bè mua khoá BodiX và được giảm ${REFERRAL_DISCOUNT_PERCENT}%`,
      body: `Tự động áp dụng khi bạn bè đăng ký bằng link của bạn.`,
    },
    {
      title: `Bạn bè vào cohort và check-in ngày đầu → bạn nhận voucher ${VOUCHER_VALUE_DISPLAY}`,
      body: `Voucher có hiệu lực ${REFERRAL_VOUCHER_EXPIRY_DAYS} ngày để bạn dùng giảm giá khi mua khoá tiếp theo.`,
    },
  ],

  // ── Điều kiện chi tiết ────────────────────────────────────────────────────
  conditions: [
    `Voucher ${VOUCHER_VALUE_DISPLAY} được tạo khi người bạn vào cohort và check-in ngày đầu.`,
    `Voucher có hiệu lực ${REFERRAL_VOUCHER_EXPIRY_DAYS} ngày kể từ khi tạo.`,
    "Voucher dùng để giảm giá khi bạn mua khoá BodiX tiếp theo.",
    "Bạn có thể dùng mã của chính mình – vẫn nhận voucher khi check-in ngày đầu.",
    "Mỗi giới thiệu thành công nhận 1 voucher.",
  ],

  // ── Cancel reasons (referral commission status='cancelled') ───────────────
  cancelReasons: {
    timeout: "Người bạn không tham gia cohort trong 60 ngày",
    no_checkin_after_active: "Người bạn không check-in trong 14 ngày sau khi vào cohort",
    dropped_before_start: "Người bạn đã ngừng tham gia",
    suspicious_burst: "Đang được rà soát",
  } as Record<string, string>,

  // ── Status pills ──────────────────────────────────────────────────────────
  trackingStatusLabel: {
    clicked: "Đã click",
    signed_up: "Đã đăng ký",
    trial_started: "Đang tập thử",
    converted: "Đã mua khoá",
    completed: "Đã hoàn thành",
    expired: "Hết hạn",
    fraudulent: "Đang rà soát",
  } as Record<string, string>,

  commissionStatusLabel: {
    pending: "Đang chờ",
    successful: "Đã nhận voucher",
    cancelled: "Đã huỷ",
  } as Record<string, string>,

  voucherStatusLabel: {
    active: "Còn hiệu lực",
    used: "Đã dùng",
    expired: "Hết hạn",
  } as Record<string, string>,

  voucherSourceLabel: {
    referral_reward: "Thưởng giới thiệu",
    admin_grant: "BodiX tặng",
    promotion: "Khuyến mãi",
  } as Record<string, string>,

  // ── Dashboard hints ───────────────────────────────────────────────────────
  pendingTooltip: "Người bạn đã mua – đang chờ vào cohort và check-in ngày đầu",
  successfulTooltip: "Voucher đã được trao",
  voucherListSubtitle: `Tổng voucher còn hiệu lực – dùng để giảm giá khi mua khoá BodiX tiếp theo. Voucher có hạn ${REFERRAL_VOUCHER_EXPIRY_DAYS} ngày kể từ khi tạo.`,
  emptyVouchersMessage: `Chưa có voucher nào. Mời bạn bè để nhận voucher ${VOUCHER_VALUE_DISPLAY} đầu tiên!`,

  // ── Share copy ────────────────────────────────────────────────────────────
  shareMessage: (link: string) =>
    `Mình đang tập với BodiX – chương trình 21 ngày thay đổi thật sự. Bạn được giảm ${REFERRAL_DISCOUNT_PERCENT}% khi đăng ký qua link này: ${link}. Tập thử 3 ngày miễn phí!`,

  zaloShareTitle: `Tập cùng mình trên BodiX – giảm ${REFERRAL_DISCOUNT_PERCENT}% khi đăng ký!`,

  // ── Promo modal (ReferralCodeSelector) ────────────────────────────────────
  promoModal: {
    headline: "🎁 Giới thiệu bạn bè",
    bullets: [
      {
        text: `Bạn bè vào cohort và check-in ngày đầu → bạn nhận voucher`,
        highlight: VOUCHER_VALUE_DISPLAY,
      },
      {
        text: "Bạn bè được giảm",
        highlight: `${REFERRAL_DISCOUNT_PERCENT}%`,
        suffix: "khi đăng ký",
      },
      {
        text: `Voucher dùng để giảm giá khi mua khoá BodiX tiếp theo (hạn ${REFERRAL_VOUCHER_EXPIRY_DAYS} ngày)`,
      },
    ],
  },

  // ── Server-side notifications (in-app + Zalo) ─────────────────────────────
  notifications: {
    inAppOnPurchase: (refereeName: string) => ({
      title: `🎉 ${refereeName} đã mua khoá qua link của bạn!`,
      body: `Voucher ${VOUCHER_VALUE_DISPLAY} sẽ được tạo khi ${refereeName} vào cohort và check-in ngày đầu.`,
    }),
  },

  // ── Profile / dashboard home labels ───────────────────────────────────────
  emptyVouchersOnProfile: `Chưa có voucher nào. Giới thiệu bạn bè – nhận voucher ${VOUCHER_VALUE_DISPLAY} khi họ vào cohort và check-in ngày đầu.`,
  giftBookSubtext: `Tặng sách "Tại sao nhịn ăn không giúp bạn gọn hơn" cho bạn bè – nhận voucher ${VOUCHER_VALUE_DISPLAY} khi họ vào cohort và check-in ngày đầu.`,
  giftBookNoCodeFallback:
    "Mã giới thiệu của bạn đang được tạo. Vui lòng tải lại trang sau vài giây.",
} as const;

export type ReferralCopy = typeof REFERRAL_COPY;
