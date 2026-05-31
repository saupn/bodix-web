/**
 * Mask a Vietnamese full name for privacy in lists shown to referrers.
 *
 * Giữ chữ ĐẦU nguyên vẹn, các chữ còn lại chỉ giữ ký tự đầu + "***".
 *   "Trần Phương Linh" → "Trần P*** L***"
 *   "Nguyễn Thị Hà"    → "Nguyễn T*** H***"
 *   "Mai"              → "Mai"
 *   "" / null          → "Ẩn danh"
 */
export function maskFullName(fullName: string | null | undefined): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Ẩn danh";
  if (parts.length === 1) return parts[0];
  const [first, ...rest] = parts;
  return [first, ...rest.map((w) => `${w[0].toUpperCase()}***`)].join(" ");
}
