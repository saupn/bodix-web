"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface IssueRow {
  id: number;
  sepay_id: number;
  payment_code: string | null;
  content: string | null;
  transfer_amount: number | null;
  status: string;
  error_message: string | null;
  received_at: string;
  matched_order_id: number | null;
  kind: "underpaid" | "overpaid" | "unmatched" | "other";
  order_payment_code: string | null;
  order_amount: number | null;
  user_name: string | null;
  user_phone: string | null;
}

function formatVnd(n: number | null): string {
  if (n == null) return "-";
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function kindBadge(kind: IssueRow["kind"]) {
  const map = {
    underpaid: { color: "bg-red-50 text-red-700 border-red-200", icon: "🔴", label: "Thiếu tiền" },
    overpaid: { color: "bg-orange-50 text-orange-700 border-orange-200", icon: "🟠", label: "Dư tiền" },
    unmatched: { color: "bg-neutral-100 text-neutral-700 border-neutral-300", icon: "⚫", label: "Không khớp" },
    other: { color: "bg-amber-50 text-amber-700 border-amber-200", icon: "⚠️", label: "Lỗi khác" },
  } as const;
  const b = map[kind];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${b.color}`}>
      <span aria-hidden>{b.icon}</span>
      {b.label}
    </span>
  );
}

export function PaymentIssuesList({ issues }: { issues: IssueRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [matchModal, setMatchModal] = useState<IssueRow | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = () => startTransition(() => router.refresh());

  const resolve = async (
    eventId: number,
    action: "manual_match" | "refund_done" | "underpaid_resolved",
    orderId?: number,
  ) => {
    setBusyId(eventId);
    try {
      const res = await fetch(`/api/admin/payments/${eventId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "manual_match" ? { action, order_id: orderId } : { action }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Không thể xử lý.");
        return;
      }
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                Nhận lúc
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                Loại
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                Số tiền
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                Mã / Nội dung
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                Ghi chú
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-neutral-600">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {issues.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-neutral-500">
                  Không có thanh toán nào cần xử lý 🎉
                </td>
              </tr>
            )}
            {issues.map((it) => (
              <tr key={it.id} className="hover:bg-neutral-50">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-600">
                  {formatDateTime(it.received_at)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">{kindBadge(it.kind)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <div className="font-medium text-neutral-900">
                    {formatVnd(it.transfer_amount)}
                  </div>
                  {it.order_amount != null && it.order_amount !== it.transfer_amount && (
                    <div className="text-xs text-neutral-500">
                      cần {formatVnd(it.order_amount)}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <div className="font-mono text-neutral-700">
                    {it.payment_code ?? <span className="italic text-neutral-400">không có</span>}
                  </div>
                  {it.content && (
                    <div className="max-w-xs truncate text-xs text-neutral-500" title={it.content}>
                      {it.content}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  {it.user_name || it.user_phone ? (
                    <>
                      <div className="font-medium text-neutral-800">
                        {it.user_name ?? "-"}
                      </div>
                      <div className="text-xs text-neutral-500">{it.user_phone ?? ""}</div>
                    </>
                  ) : (
                    <span className="text-neutral-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-600">
                  <div className="max-w-sm" title={it.error_message ?? ""}>
                    {it.error_message ?? "-"}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {it.kind === "unmatched" && (
                    <button
                      type="button"
                      onClick={() => setMatchModal(it)}
                      disabled={busyId === it.id}
                      className="rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                    >
                      Match thủ công
                    </button>
                  )}
                  {it.kind === "overpaid" && (
                    <button
                      type="button"
                      onClick={() => resolve(it.id, "refund_done")}
                      disabled={busyId === it.id}
                      className="rounded-md border border-orange-300 bg-white px-2.5 py-1 text-xs font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                    >
                      Đã hoàn tiền dư
                    </button>
                  )}
                  {it.kind === "underpaid" && (
                    <button
                      type="button"
                      onClick={() => resolve(it.id, "underpaid_resolved")}
                      disabled={busyId === it.id}
                      className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Đã xử lý
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {matchModal && (
        <ManualMatchModal
          issue={matchModal}
          onClose={() => setMatchModal(null)}
          onMatched={() => {
            setMatchModal(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

function ManualMatchModal({
  issue,
  onClose,
  onMatched,
}: {
  issue: IssueRow;
  onClose: () => void;
  onMatched: () => void;
}) {
  const [orderIdInput, setOrderIdInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const orderId = parseInt(orderIdInput.trim(), 10);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      setError("Order ID phải là số dương.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payments/${issue.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "manual_match", order_id: orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không thể match.");
        return;
      }
      onMatched();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-lg font-bold text-primary">
          Match thủ công
        </h2>
        <div className="mt-3 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-700">
          <p>
            <span className="text-neutral-500">Số tiền:</span>{" "}
            <span className="font-medium">{formatVnd(issue.transfer_amount)}</span>
          </p>
          <p className="mt-1 break-words">
            <span className="text-neutral-500">Nội dung:</span> {issue.content ?? "-"}
          </p>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">
              Order ID cần match
            </span>
            <input
              type="number"
              value={orderIdInput}
              onChange={(e) => setOrderIdInput(e.target.value)}
              placeholder="VD: 123"
              required
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {loading ? "Đang match..." : "Match"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
