export const PROGRAMS = {
  bodix21: {
    name: "BodiX 21",
    slug: "bodix21",
    price: 499000,
    duration: "21 ngày",
    description:
      "21 ngày tập luyện có hệ thống, tin nhắn nhắc tập qua Zalo mỗi ngày",
    momoQR: "/images/momo_bodix21.jpg",
  },
  bodix6w: {
    name: "BodiX 6 tuần",
    slug: "bodix6w",
    price: 1199000,
    duration: "6 tuần",
    description:
      "6 tuần thay đổi rõ rệt, tập trung body composition",
    momoQR: "/images/momo_bodix6w.jpg",
  },
  bodix12w: {
    name: "BodiX 12 tuần",
    slug: "bodix12w",
    price: 1999000,
    duration: "12 tuần",
    description:
      "12 tuần lột xác có kiểm soát, hành trình cao cấp nhất",
    momoQR: "/images/momo_bodix12w.jpg",
  },
} as const;

export type ProgramSlug = keyof typeof PROGRAMS;

export const PAYMENT_INFO = {
  bank: {
    bankName: "TPBank",
    accountNumber: "2846 8686 886",
    accountName: "Pham Ngoc Sau",
  },
};

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + "đ";
}
