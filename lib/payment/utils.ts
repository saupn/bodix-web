/**
 * Định dạng số tiền VND.
 * formatPrice(599000) → "599.000đ"
 * formatPrice(1299000) → "1.299.000đ"
 */
export function formatPrice(vnd: number): string {
  const formatted = Math.round(vnd)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${formatted}đ`
}

export interface PaymentMethod {
  id: string
  name: string
  description: string
  icon: string          // identifier cho UI icon component
  available: boolean
  comingSoon?: boolean
}

/**
 * Danh sách phương thức thanh toán.
 * available=false + comingSoon=true → hiển thị "Sắp có" trên UI.
 */
export function getPaymentMethods(): PaymentMethod[] {
  return [
    {
      id: 'bank_transfer',
      name: 'Chuyển khoản ngân hàng',
      description: 'Chuyển khoản trực tiếp tới tài khoản BodiX. Xác nhận trong 1–2 giờ.',
      icon: 'bank',
      available: true,
    },
    {
      id: 'momo',
      name: 'MoMo',
      description: 'Thanh toán qua ví MoMo',
      icon: 'momo',
      available: false,
      comingSoon: true,
    },
    {
      id: 'vnpay',
      name: 'VNPay',
      description: 'ATM, Visa, Mastercard qua cổng VNPay',
      icon: 'vnpay',
      available: false,
      comingSoon: true,
    },
    {
      id: 'zalopay',
      name: 'ZaloPay',
      description: 'Thanh toán qua ví ZaloPay',
      icon: 'zalopay',
      available: false,
      comingSoon: true,
    },
    {
      id: 'stripe',
      name: 'Thẻ quốc tế',
      description: 'Visa / Mastercard cho khách quốc tế — powered by Stripe',
      icon: 'stripe',
      available: false,
      comingSoon: true,
    },
  ]
}

/** Tổng số phương thức đang available. */
export function getAvailablePaymentMethodCount(): number {
  return getPaymentMethods().filter((m) => m.available).length
}
