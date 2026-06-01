/**
 * Single source of truth for affiliate-program user-facing copy.
 *
 * Bất kỳ trang/component nào hiển thị nội dung về chương trình Đối tác phải
 * import từ đây — KHÔNG hardcode số tiền, mô tả flow, hay điều kiện vào UI.
 *
 * Khi business logic đổi (rate, min withdraw, cooldown), chỉ sửa file này +
 * lib/affiliate/config.ts; UI tự update.
 */

import {
  AFFILIATE_COMMISSION_RATE,
  AFFILIATE_MIN_WITHDRAW_VND,
  AFFILIATE_NO_CHECKIN_TIMEOUT_DAYS,
  AFFILIATE_PENDING_TIMEOUT_DAYS,
  AFFILIATE_DISCOUNT_PERCENT,
} from "@/lib/affiliate/config";

function formatVnd(amount: number): string {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

export const AFFILIATE_COPY = {
  // ── Numbers (re-export from config so UI dùng 1 import) ───────────────────
  commissionRate: AFFILIATE_COMMISSION_RATE,
  commissionRateDisplay: `${AFFILIATE_COMMISSION_RATE}%`,
  refereeDiscountPercent: AFFILIATE_DISCOUNT_PERCENT,
  refereeDiscountDisplay: `${AFFILIATE_DISCOUNT_PERCENT}%`,
  minWithdrawVnd: AFFILIATE_MIN_WITHDRAW_VND,
  minWithdrawDisplay: formatVnd(AFFILIATE_MIN_WITHDRAW_VND),
  pendingTimeoutDays: AFFILIATE_PENDING_TIMEOUT_DAYS,
  noCheckinTimeoutDays: AFFILIATE_NO_CHECKIN_TIMEOUT_DAYS,
  withdrawalEnabled: false,

  // ── Tagline ngắn ──────────────────────────────────────────────────────────
  shortTagline:
    `Nhận ${AFFILIATE_COMMISSION_RATE}% hoa hồng tiền mặt khi bạn bè bắt đầu hành trình BodiX qua giới thiệu của bạn. Người bạn được giảm ${AFFILIATE_DISCOUNT_PERCENT}% khi mua khoá đầu tiên.`,

  metaDescription:
    `Nhận ${AFFILIATE_COMMISSION_RATE}% hoa hồng tiền mặt khi bạn bè bắt đầu hành trình BodiX qua giới thiệu của bạn. Hoa hồng được trả khi người bạn vào cohort và check-in ngày đầu.`,

  // ── 3 bước nhận hoa hồng ──────────────────────────────────────────────────
  flowSteps: [
    {
      title: "Bạn bè click link và mua khoá BodiX",
      body: "Hoa hồng được tạo ngay sau khi đơn thanh toán thành công.",
      pillLabel: "Đang chờ",
    },
    {
      title: "Bạn bè vào cohort và check-in ngày đầu",
      body: "Đây là lúc hoa hồng chuyển sang trạng thái có thể rút – BodiX chỉ trả tiền khi người bạn thật sự bắt đầu hành trình.",
      pillLabel: "Có thể rút",
    },
    {
      title: `Khi tổng có thể rút đạt ${formatVnd(AFFILIATE_MIN_WITHDRAW_VND)} trở lên`,
      body: "Bạn yêu cầu chuyển khoản về tài khoản ngân hàng đã đăng ký. Tích luỹ qua nhiều lần giới thiệu thành công.",
      pillLabel: "Đã rút",
    },
  ],

  // ── Thông điệp đối tác (partner, không transaction) ───────────────────────
  partnerMessage:
    "Bạn là đối tác cùng BodiX giúp người được giới thiệu vào nhịp tập. Khi họ check-in ngày đầu, đồng nghĩa hành trình đã thật sự bắt đầu – và hoa hồng của bạn được kích hoạt.",

  // ── Điều kiện chi tiết (tinh thần partner) ────────────────────────────────
  conditions: [
    `Hoa hồng tính trên số tiền người được giới thiệu đã thanh toán (sau khi áp giảm giá ${AFFILIATE_DISCOUNT_PERCENT}%).`,
    "Bạn và BodiX cùng đồng hành – khi người được giới thiệu vào cohort và check-in ngày đầu, hoa hồng của bạn được kích hoạt.",
    `Bạn có thể giúp người được giới thiệu bắt đầu sớm để hoa hồng sớm được kích hoạt. Nếu họ chưa kịp tham gia đợt tập trong ${AFFILIATE_PENDING_TIMEOUT_DAYS} ngày, hành trình này tạm khép lại.`,
    `Tối thiểu ${formatVnd(AFFILIATE_MIN_WITHDRAW_VND)} cho mỗi lần rút – tích luỹ qua nhiều lần đồng hành thành công.`,
    "Mã Đối tác chỉ dành cho người khác. Muốn tự nhận ưu đãi, hãy dùng link Giới thiệu bạn bè (referral).",
    "Hoa hồng của bạn đang được tích lũy an toàn. Tính năng rút tiền đang được hoàn thiện và sẽ sớm ra mắt – chúng tôi sẽ thông báo khi bạn có thể rút.",
  ],

  // ── Cancel reasons (tinh thần partner, không transaction) ──────────────────
  cancelReasons: {
    timeout: `Bạn và người được giới thiệu cùng đồng hành chưa thành – chưa kịp tham gia đợt tập trong ${AFFILIATE_PENDING_TIMEOUT_DAYS} ngày`,
    no_checkin_after_active: `Hành trình chưa thật sự bắt đầu – người được giới thiệu chưa check-in trong ${AFFILIATE_NO_CHECKIN_TIMEOUT_DAYS} ngày sau khi vào cohort`,
    dropped_before_start: "Người được giới thiệu chưa tham gia cohort lần này",
    suspicious_burst: "Hoa hồng đang được rà soát",
    manual: "Đã huỷ thủ công",
  } as Record<string, string>,

  // ── Referee list status (section "Người được giới thiệu") ─────────────────
  refereeStatusLabel: {
    pending: "Đang chờ check-in",
    payable: "Hoa hồng đã được kích hoạt",
    paid: "Hoa hồng đã được rút",
    cancelled: "Đã huỷ",
    suspicious: "Đang rà soát",
  } as Record<string, string>,
  refereeEmptyState:
    "Chưa có ai được giới thiệu qua link của bạn. Hãy chia sẻ link để bắt đầu hành trình đồng hành cùng BodiX!",

  // ── Status pill labels ────────────────────────────────────────────────────
  statusLabel: {
    pending: "Đang chờ",
    payable: "Có thể rút",
    paid: "Đã rút",
    cancelled: "Đã huỷ",
    suspicious: "Đang xét",
  } as Record<string, string>,

  // ── Card hints (dashboard summary) ────────────────────────────────────────
  pendingHint: "Chờ người bạn vào cohort và check-in ngày đầu",
  payableBelowMinHint: (remaining: number) =>
    `Cần ≥ ${formatVnd(AFFILIATE_MIN_WITHDRAW_VND)} để rút (còn thiếu ${formatVnd(remaining)})`,
  payableAboveMinHint:
    "Hoa hồng của bạn đang được tích lũy an toàn. Tính năng rút tiền đang được hoàn thiện và sẽ sớm ra mắt – chúng tôi sẽ thông báo khi bạn có thể rút.",

  // ── Withdraw section ──────────────────────────────────────────────────────
  withdrawDisabledMessage:
    "Hoa hồng của bạn đang được tích lũy an toàn. Tính năng rút tiền đang được hoàn thiện và sẽ sớm ra mắt – chúng tôi sẽ thông báo khi bạn có thể rút.",
  withdrawDisabledTooltip:
    "Hoa hồng của bạn đang được tích lũy an toàn. Tính năng rút tiền đang được hoàn thiện và sẽ sớm ra mắt.",

  // ── FAQ ───────────────────────────────────────────────────────────────────
  faq: [
    {
      q: "Khi nào tôi nhận được tiền?",
      a: `Khi tổng hoa hồng có thể rút từ ${formatVnd(AFFILIATE_MIN_WITHDRAW_VND)} trở lên, bạn yêu cầu chuyển khoản về tài khoản ngân hàng. Chúng tôi sẽ chuyển khoản trong vòng 3–5 ngày làm việc sau khi xác nhận.`,
    },
    {
      q: "Tại sao hoa hồng của tôi bị huỷ?",
      a: `Hoa hồng chỉ được trả khi người bạn thực sự tập BodiX. Nếu họ không vào cohort trong ${AFFILIATE_PENDING_TIMEOUT_DAYS} ngày, hoặc vào nhưng không check-in trong ${AFFILIATE_NO_CHECKIN_TIMEOUT_DAYS} ngày, hoa hồng sẽ bị huỷ. Điều này đảm bảo BodiX chỉ trả tiền cho những giới thiệu chất lượng.`,
    },
    {
      q: "Tôi có thể dùng mã của chính mình không?",
      a: "Không. Mã affiliate chỉ dành cho người khác. Nếu bạn muốn nhận giảm giá cho bản thân, hãy dùng chương trình Giới thiệu bạn bè (referral) – tính năng riêng dành cho điều này.",
    },
    {
      q: "Khi nào tính năng rút tiền sẽ mở?",
      a: "Chúng tôi đang hoàn thiện tính năng này và sẽ mở trong giai đoạn tiếp theo. Trong khi chờ, hoa hồng của bạn vẫn được tích luỹ an toàn trong dashboard.",
    },
  ],

  // ── Public registration page (/affiliate) ─────────────────────────────────
  publicRegistration: {
    heroTitle: "Chương trình Đối tác BodiX",
    heroSubtitle: (rate: number = AFFILIATE_COMMISSION_RATE) =>
      `Nhận ${rate}% hoa hồng tiền mặt khi bạn bè bắt đầu hành trình BodiX qua giới thiệu của bạn`,
    benefits: [
      {
        big: `${AFFILIATE_COMMISSION_RATE}%`,
        small: `Hoa hồng tính trên số tiền người bạn đã thanh toán (sau khi áp giảm giá ${AFFILIATE_DISCOUNT_PERCENT}%)`,
      },
      {
        big: `${AFFILIATE_DISCOUNT_PERCENT}%`,
        small: "Giảm giá tự động cho người bạn khi mua qua link của bạn",
      },
      {
        big: formatVnd(AFFILIATE_MIN_WITHDRAW_VND).replace("đ", "").replace(/\./g, ""),
        small: "Tối thiểu mỗi lần rút – tích luỹ từ nhiều lần giới thiệu thành công",
      },
    ],
    audienceTitle: "Dành cho ai?",
    audienceList: [
      "PT / Personal Trainer muốn giới thiệu cho học viên",
      "KOL / Influencer trong lĩnh vực fitness, sức khoẻ",
      "Chủ phòng gym / studio muốn cung cấp thêm giá trị cho hội viên",
      "Blogger / Content creator trong lĩnh vực lifestyle",
    ],
    formTitle: "Đăng ký làm Đối tác",
    submitButton: "Đăng ký ngay",
    submitting: "Đang xử lý...",
    successTitle: "Chúc mừng! Bạn đã trở thành Đối tác BodiX",
    successBody:
      "Đăng nhập vào dashboard để lấy link giới thiệu của bạn và bắt đầu tích luỹ hoa hồng.",
    successCta: "Mở dashboard Đối tác",
  },

  // ── Promo modal (ReferralCodeSelector) ────────────────────────────────────
  promoModal: {
    headline: "💰 Chương trình Đối tác",
    forWho: "(Dành cho người muốn kiếm thu nhập từ BodiX)",
    bullets: [
      {
        prefix: "Hoa hồng",
        highlight: `${AFFILIATE_COMMISSION_RATE}%`,
        suffix: "tiền mặt cho mỗi đơn người bạn đã thanh toán",
      },
      {
        prefix: "Người mua qua link của bạn được giảm",
        highlight: `${AFFILIATE_DISCOUNT_PERCENT}%`,
        suffix: "",
      },
      { text: "Hoa hồng chuyển thành tiền có thể rút khi người bạn vào cohort và check-in ngày đầu" },
      { text: `Tối thiểu ${formatVnd(AFFILIATE_MIN_WITHDRAW_VND)} mỗi lần rút` },
      { text: "Đăng ký 1 click trong dashboard sau khi đăng nhập" },
    ],
  },

  // ── Zalo / in-app notification messages (server-side) ─────────────────────
  notifications: {
    zaloAfterApply: (firstName: string) =>
      `🤝 Chúc mừng ${firstName}! Bạn là Đối tác BodiX.\n` +
      `Hoa hồng ${AFFILIATE_COMMISSION_RATE}% tiền mặt cho mỗi đơn người bạn đã thanh toán.\n` +
      `Tiền chuyển sang "có thể rút" khi người bạn vào cohort và check-in ngày đầu.\n` +
      `Tối thiểu ${formatVnd(AFFILIATE_MIN_WITHDRAW_VND)} mỗi lần rút.\n` +
      `Xem dashboard: bodix.fit/app/affiliate`,
    inAppOnReferralPurchase: (refereeName: string) => ({
      title: `🎉 ${refereeName} đã mua khoá qua link của bạn!`,
      body: `Hoa hồng ${AFFILIATE_COMMISSION_RATE}% đang chờ – sẽ chuyển sang "Có thể rút" khi ${refereeName} vào cohort và check-in ngày đầu.`,
    }),
  },
} as const;

export type AffiliateCopy = typeof AFFILIATE_COPY;
