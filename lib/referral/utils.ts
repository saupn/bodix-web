/**
 * Referral code utilities — personalized codes from name
 */

/** Bỏ dấu tiếng Việt */
export function removeDiacritics(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/** Chuẩn hóa cho mã: bỏ dấu, viết hoa, chỉ giữ A-Z0-9. */
export function normalizeForCode(str: string): string {
  return removeDiacritics(str)
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

/** Gợi ý mã từ full_name (3–4 options) */
export function suggestReferralCodes(fullName: string): string[] {
  const clean = removeDiacritics(fullName.trim());
  if (!clean) return [];

  const parts = clean.split(/\s+/).filter(Boolean);
  const suggestions: string[] = [];
  const seen = new Set<string>();

  function add(s: string) {
    const normalized = s.replace(/[^A-Z0-9.]/g, "").toUpperCase();
    if (normalized.length >= 3 && normalized.length <= 15 && !seen.has(normalized)) {
      seen.add(normalized);
      suggestions.push(normalized);
    }
  }

  // Tên cuối (thường là tên chính): LAN
  if (parts.length > 0) {
    const lastName = parts[parts.length - 1].toUpperCase();
    add(lastName);
  }

  // Họ + tên: NGUYENLAN
  if (parts.length >= 2) {
    const first = parts[0].toUpperCase();
    const last = parts[parts.length - 1].toUpperCase();
    add(first + last);
  }

  // Tên.BODIX: LAN.BODIX
  if (parts.length > 0) {
    const last = parts[parts.length - 1].toUpperCase();
    add(`${last}.BODIX`);
  }

  // Họ đệm + tên: THILAN
  if (parts.length >= 3) {
    const middle = parts.slice(1, -1).join("").toUpperCase();
    const last = parts[parts.length - 1].toUpperCase();
    add(middle + last);
  } else if (parts.length === 2) {
    add(parts[0].toUpperCase() + parts[1].toUpperCase());
  }

  return suggestions.slice(0, 4);
}

/** Validate mã: 3–15 ký tự, A-Z 0-9 dấu chấm */
export function isValidReferralCode(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  if (normalized.length < 3 || normalized.length > 15) return false;
  return /^[A-Z0-9.]+$/.test(normalized);
}

/** Sanitize input: uppercase, chỉ giữ A-Z0-9. */
export function sanitizeReferralCodeInput(input: string): string {
  return input
    .replace(/[^A-Za-z0-9.]/g, "")
    .toUpperCase()
    .slice(0, 15);
}
