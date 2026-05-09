export const SEPAY_CONFIG = {
  bankCode: process.env.BANK_CODE || 'TPBank',
  bankAccount: process.env.BANK_ACCOUNT || '60909091560',
  bankAccountName: process.env.BANK_ACCOUNT_NAME || 'PHAM NGOC SAU',
  apiKey: process.env.SEPAY_API_KEY!,
  prefix: 'BX',
};

export type SePayQRTemplate = 'default' | 'compact' | 'qronly';

export function getSePayQRUrl(
  amount: number,
  paymentCode: string,
  template: SePayQRTemplate = 'compact',
): string {
  const params = new URLSearchParams({
    acc: SEPAY_CONFIG.bankAccount,
    bank: SEPAY_CONFIG.bankCode,
    amount: amount.toString(),
    des: paymentCode,
    template,
  });
  return `https://qr.sepay.vn/img?${params.toString()}`;
}

// BX + 3-10 chữ số. Khớp cả khi nằm trong câu dài "Chuyen tien BX1234 abc".
export function extractPaymentCodeFromContent(content: string): string | null {
  const match = content.toUpperCase().match(/BX\d{3,10}/);
  return match ? match[0] : null;
}

export function isValidPaymentCode(code: string): boolean {
  return /^BX\d{3,10}$/.test(code);
}
