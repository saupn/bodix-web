/**
 * Genome v1 — risk scoring mirror.
 *
 * ⚠️ NGUỒN SỰ THẬT là SQL trong supabase/migrations/063_genome_signal_patterns.sql
 * (hàm bodix_snapshot_enrollment_daily, đã thay 062). File này PHẢI khớp từng
 * luật với SQL đó. Mục đích: unit-test công thức risk trong CI (node:test) mà
 * không cần DB. Khi sửa luật ở SQL, sửa luôn ở đây + cập nhật test.
 *
 * Luật điểm (cộng dồn, cap 100):
 *   consecutive_missed >= 1            → +25
 *   consecutive_missed >= 2            → +25
 *   consecutive_missed >= 3            → +25
 *   feeling (hôm nay) != null và <= 2  → +15
 *   last_nudge_led_to_checkin IS false → +10   (chỉ khi đúng false, null không tính)
 *   low_feeling_trend (recent_avg<2.0) → +15   (063: thay cho +5 mode-light cũ)
 *
 * KHÔNG còn cộng điểm cho mode-light hôm nay (063 bỏ, triết lý completion-first).
 * downgrade_pattern (recent_all_light) CHỈ ghi nhận, KHÔNG vào risk_score.
 *
 * Band:
 *   high   nếu TỔNG (đủ 6 luật trên) >= 60
 *   medium nếu (missed>=1?25) + (missed>=2?25) + (feeling<=2?15) >= 30
 *   else low
 * Band 'high' dùng tổng đầy đủ; band 'medium' chỉ dùng tập con (missed cấp 1+2
 * và feeling hôm nay) — KHÔNG gồm missed cấp 3, nudge, hay low_feeling_trend.
 */

export type RiskBand = "low" | "medium" | "high";

export interface RiskInput {
  consecutiveMissed: number;
  /** Feeling của check-in HÔM NAY (null nếu không check-in / không báo). */
  feeling: number | null;
  lastNudgeLedToCheckin: boolean | null;
  /** Xu hướng feeling 5 buổi gần nhất < 2.0 (đã đủ >=3 buổi có feeling). */
  lowFeelingTrend: boolean;
}

/** Tổng điểm đầy đủ (chưa cap) — dùng cho risk_score và ngưỡng band 'high'. */
function fullScore(i: RiskInput): number {
  let s = 0;
  if (i.consecutiveMissed >= 1) s += 25;
  if (i.consecutiveMissed >= 2) s += 25;
  if (i.consecutiveMissed >= 3) s += 25;
  if (i.feeling != null && i.feeling <= 2) s += 15;
  if (i.lastNudgeLedToCheckin === false) s += 10;
  if (i.lowFeelingTrend) s += 15;
  return s;
}

export function computeRiskScore(i: RiskInput): number {
  return Math.min(100, fullScore(i));
}

export function computeRiskBand(i: RiskInput): RiskBand {
  if (fullScore(i) >= 60) return "high";

  let medium = 0;
  if (i.consecutiveMissed >= 1) medium += 25;
  if (i.consecutiveMissed >= 2) medium += 25;
  if (i.feeling != null && i.feeling <= 2) medium += 15;
  if (medium >= 30) return "medium";

  return "low";
}
