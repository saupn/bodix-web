/**
 * Date strings (YYYY-MM-DD) theo múi Asia/Ho_Chi_Minh.
 */

export function getVietnamDateString(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

/** Ngày mai (theo lịch VN), định dạng YYYY-MM-DD */
export function getVietnamTomorrowDateString(): string {
  const today = getVietnamDateString();
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return { y: +m[1], m: +m[2], d: +m[3] };
}

/** ISO timestamp → YYYY-MM-DD theo lịch Việt Nam */
export function isoTimestampToVietnamYmd(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

/** Số ngày lịch giữa startYmd và endYmd (end − start); cùng ngày → 0 */
export function calendarDaysBetween(startYmd: string, endYmd: string): number {
  const a = parseYmd(startYmd);
  const b = parseYmd(endYmd);
  if (!a || !b) return 0;
  const t0 = Date.UTC(a.y, a.m - 1, a.d);
  const t1 = Date.UTC(b.y, b.m - 1, b.d);
  return Math.floor((t1 - t0) / 86400000);
}

export function addCalendarDays(ymd: string, delta: number): string {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d));
  d.setUTCDate(d.getUTCDate() + delta);
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
