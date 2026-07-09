/**
 * Rescue Protocol — escalation theo số ngày lỡ nhịp (adaptive morning message).
 *
 * missedDays = số NGÀY TẬP (T2–T7) liên tiếp gần nhất KHÔNG có check-in, tính đến
 * HÔM QUA (hôm nay chưa tính vì tin gửi buổi sáng, user chưa kịp tập). Chủ nhật là
 * ngày Review (không tập) → KHÔNG đếm.
 *
 * Bands:
 *   0–1  → normal   (tin sáng bình thường)
 *   2    → L1       (thăm hỏi nhẹ + gợi ý 1 lượt Easy)
 *   3–4  → L2       (thăm hỏi sâu hơn, mời chia sẻ)
 *   5–7  → L3       (tin chân thành, cửa luôn mở)
 *   >7   → dormant  (DỪNG tin sáng hằng ngày, chỉ giữ tin Review CN)
 *
 * Giọng: KHÔNG trách móc, KHÔNG guilt-trip, KHÔNG đếm ngày lỡ kiểu tội lỗi,
 * KHÔNG nhắc cân nặng/kết quả. Cửa luôn mở, bước quay lại luôn NHỎ (1 lượt Easy).
 *
 * Mỗi tin rescue = thăm hỏi + BÀI TẬP HÔM NAY + magic link phiên tập. Thăm hỏi
 * THÊM vào, KHÔNG thay bài tập: user muốn quay lại phải biết bấm đâu.
 */

import { addCalendarDays, getVietnamWeekday } from "@/lib/date/vietnam";

export type RescueLevel = "normal" | "l1" | "l2" | "l3" | "dormant";

/**
 * Đếm số ngày tập (không phải CN) bị lỡ liên tiếp gần nhất, tính đến hôm qua.
 * @param lastCheckinYmd  workout_date của check-in gần nhất (YYYY-MM-DD) hoặc null nếu chưa từng.
 * @param startYmd        ngày bắt đầu chương trình (mốc khi chưa có check-in nào).
 * @param todayVN         hôm nay theo lịch VN (YYYY-MM-DD).
 */
export function countMissedWorkoutDays(
  lastCheckinYmd: string | null,
  startYmd: string,
  todayVN: string,
): number {
  // Mốc bắt đầu đếm: sau check-in gần nhất; nếu chưa từng check-in → từ ngày bắt đầu.
  const anchor = lastCheckinYmd ? addCalendarDays(lastCheckinYmd, 1) : startYmd;
  const end = addCalendarDays(todayVN, -1); // đến hôm qua (hôm nay chưa tính)

  let count = 0;
  let d = anchor;
  // Bảo vệ vòng lặp: tối đa 60 ngày.
  for (let i = 0; i < 60 && d <= end; i++) {
    if (getVietnamWeekday(d) !== 0) count++; // bỏ Chủ nhật
    d = addCalendarDays(d, 1);
  }
  return count;
}

export function rescueLevel(missedDays: number): RescueLevel {
  if (missedDays > 7) return "dormant";
  if (missedDays >= 5) return "l3";
  if (missedDays >= 3) return "l2";
  if (missedDays >= 2) return "l1";
  return "normal";
}

// ── Buổi tập hôm nay (chèn vào mọi tin rescue) ──

/**
 * Bài tập hôm nay của user, đọc từ workout_templates (source of truth).
 * exerciseLines: tên bài ĐÃ dịch "Tiếng Việt (English)" — rỗng với ngày Recovery.
 * workoutUrl: magic link /w/[token] (giống tin sáng thường).
 */
export interface RescueWorkoutContext {
  sessionTitle: string;
  exerciseLines: string[];
  workoutUrl: string;
}

/**
 * Khối "Buổi hôm nay" + link. Trả chuỗi rỗng nếu không dựng được context
 * (không có workout_template) → tin rescue vẫn gửi được, chỉ mất phần bài tập.
 */
function buildWorkoutBlock(ctx: RescueWorkoutContext | null): string {
  if (!ctx) return '';
  const items = ctx.exerciseLines.map((ex) => `- ${ex}`).join('\n');
  const list = items ? `\n${items}` : '';
  return `Buổi hôm nay: ${ctx.sessionTitle}${list}\n\n▶️ Xem bài: ${ctx.workoutUrl}`;
}

// ── Templates (giọng chia sẻ, không phán xét) ──

export function buildRescueL1(name: string, ctx: RescueWorkoutContext | null): string {
  const workout = buildWorkoutBlock(ctx);
  return (
    `Chào ${name}, 2 hôm nay mình chưa thấy bạn check-in. Bận rộn phải không? ` +
    `Không sao cả – hôm nay chỉ cần 1 lượt Easy (khoảng 7 phút) là bạn quay lại nhịp rồi.\n` +
    (workout ? `\n${workout}\n` : '') +
    `\nTập xong nhắn 1, 2 hoặc 3 như mọi khi nhé. Cứ nhẹ nhàng thôi!`
  );
}

export function buildRescueL2(name: string, ctx: RescueWorkoutContext | null): string {
  const workout = buildWorkoutBlock(ctx);
  return (
    `${name} ơi, mấy hôm nay bạn thế nào? Nếu đang mệt hoặc quá bận, cứ nhắn cho mình biết nhé ` +
    `– không cần lý do hoàn hảo đâu.\n` +
    (workout ? `\nNếu hôm nay muốn quay lại, chỉ 1 lượt Easy là đủ để bắt đầu lại:\n\n${workout}\n` : '') +
    `\nTập xong nhắn 1, 2 hoặc 3. Quan trọng nhất là bạn vẫn ở đây.`
  );
}

export function buildRescueL3(name: string, ctx: RescueWorkoutContext | null): string {
  const workout = buildWorkoutBlock(ctx);
  return (
    `Chào ${name}, đã gần 1 tuần mình chưa gặp bạn. Mình nhắn không phải để tạo áp lực ` +
    `– chỉ muốn bạn biết chỗ tập của bạn vẫn ở đây, quay lại lúc nào cũng được.\n` +
    (workout ? `\nNếu hôm nay sẵn sàng, chỉ cần 1 lượt Easy:\n${workout}\n` : '') +
    `\nCòn nếu có điều gì khiến bạn khó duy trì, nhắn cho mình 1 câu nhé. Mình thật sự muốn nghe.`
  );
}

/** Câu chào mừng khi user vừa quay lại hôm qua (prepend vào tin sáng bình thường). */
export const WELCOME_BACK_LINE =
  "Vui vì bạn đã quay lại hôm qua! Hôm nay mình tiếp tục nhé.";

/** Gom nội dung tin rescue theo level (l1/l2/l3). normal/dormant không có tin ở đây. */
export function buildRescueMessage(
  level: RescueLevel,
  name: string,
  ctx: RescueWorkoutContext | null,
): string | null {
  switch (level) {
    case "l1":
      return buildRescueL1(name, ctx);
    case "l2":
      return buildRescueL2(name, ctx);
    case "l3":
      return buildRescueL3(name, ctx);
    default:
      return null;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AWAITING REPLY — cửa sổ chờ user tâm sự sau tin rescue
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Tin rescue mời user chia sẻ ("cứ nhắn cho mình biết"). Trong 48h sau đó, tin
 * nhắn text (không phải số check-in) được coi là tâm sự → bot trả lời ấm áp +
 * đánh dấu cho Founder trả lời tay, KHÔNG đẩy vào FAQ/fallback.
 */
export const RESCUE_AWAITING_HOURS = 48;

/** Thời điểm hết hạn cửa sổ awaiting, tính từ lúc gửi tin rescue. */
export function rescueAwaitingUntil(now: Date = new Date()): string {
  return new Date(now.getTime() + RESCUE_AWAITING_HOURS * 3600_000).toISOString();
}

/**
 * Câu ấm áp trả lời tức thì khi user tâm sự. Gửi TỐI ĐA 1 lần/ngày cho 1 user —
 * user nhắn tiếp vẫn được ghi nhận cho Founder, chỉ không lặp lại câu này.
 */
export function buildRescueAckMessage(name: string): string {
  return (
    `Cảm ơn bạn đã chia sẻ với mình, ${name}. ` +
    `Mình đã đọc và sẽ nhắn lại bạn sớm nhất nhé. Bạn không hề đơn độc đâu.`
  );
}
