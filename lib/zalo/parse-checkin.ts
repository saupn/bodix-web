// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PARSE TIN NHẮN CHECK-IN QUA ZALO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tin nhắc tập buổi sáng hướng dẫn user báo số lượt đã tập:
//   3 → đủ 3 lượt (~21 phút)
//   2 → 2 lượt (~14 phút)
//   1 → 1 lượt (~7 phút)
//
// Chỉ nhận diện check-in khi tin nhắn CHÍNH XÁC là "1", "2" hoặc "3" (sau trim).
// KHÔNG dùng includes()/regex lỏng — "tập 3 lượt", "câu 2", "1 cái"... KHÔNG phải
// check-in (tránh false positive ghi nhận tập sai). Những trường hợp đó rơi xuống
// tầng FAQ/fallback, an toàn hơn là ghi nhận nhầm.
//
// Số lượt được lưu vào daily_checkins.mode (không có cột rounds riêng):
//   3 lượt → mode 'hard', 2 lượt → mode 'light', 1 lượt → mode 'easy'.
// Map rounds → mode ở phía gọi (webhook), helper này chỉ trả về số lượt.

export type CheckinResult =
  | { isCheckin: true; rounds: 1 | 2 | 3 }
  | { isCheckin: false };

export function parseCheckin(message: string): CheckinResult {
  const trimmed = message.trim();

  // EXACT match — KHÔNG includes(), KHÔNG startsWith().
  if (trimmed === '1') return { isCheckin: true, rounds: 1 };
  if (trimmed === '2') return { isCheckin: true, rounds: 2 };
  if (trimmed === '3') return { isCheckin: true, rounds: 3 };

  return { isCheckin: false };
}

/** Map số lượt → mode lưu trong daily_checkins (CHECK constraint: hard/light/easy/...). */
export function roundsToMode(rounds: 1 | 2 | 3): 'hard' | 'light' | 'easy' {
  return rounds === 3 ? 'hard' : rounds === 2 ? 'light' : 'easy';
}
