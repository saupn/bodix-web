import Link from "next/link";
import { REFERRAL_COPY } from "@/lib/copy/referral";

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
            {REFERRAL_COPY.giftBookSubtextBefore}
            <a
              href="/api/guides/download"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
            >
              &quot;{REFERRAL_COPY.giftBookTitle}&quot;
            </a>
            {REFERRAL_COPY.giftBookSubtextAfter}
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
