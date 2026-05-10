import Link from "next/link";

/**
 * Small teaser card linking to /app/tang-sach. Rendered at the bottom of
 * every dashboard home state (active, trial, paid_waiting, etc.) so every
 * user sees the lead-gen offer regardless of enrollment status.
 */
export function GiftBookCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mt-6">
      <div className="flex items-start gap-3">
        <span className="text-2xl">📖</span>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">Tặng sách cho bạn bè</h3>
          <p className="text-sm text-gray-600 mt-1">
            Tặng sách &quot;Tại sao nhịn ăn không giúp bạn gọn hơn&quot; cho bạn
            bè – nhận voucher 100K khi họ tham gia.
          </p>
          <Link
            href="/app/tang-sach"
            className="text-sm text-primary font-medium mt-2 inline-block hover:underline"
          >
            Xem chi tiết →
          </Link>
        </div>
      </div>
    </div>
  );
}
