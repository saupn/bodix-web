"use client";

import { useEffect, useState } from "react";

interface Order {
  id: number;
  order_code: string;
  user_id: string | null;
  program: string;
  amount: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  confirmed_at: string | null;
  full_name: string;
  phone: string;
  email: string;
}

const STATUS_LABELS: Record<string, string> = {
  confirming: "Chờ xác nhận",
  paid: "Đã thanh toán",
  pending: "Chờ thanh toán",
  failed: "Thất bại",
  refunded: "Đã hoàn tiền",
};

const STATUS_CLASS: Record<string, string> = {
  confirming: "bg-amber-100 text-amber-800",
  paid: "bg-green-100 text-green-800",
  pending: "bg-neutral-100 text-neutral-600",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-neutral-100 text-neutral-500",
};

const PM_LABELS: Record<string, string> = {
  momo: "MoMo",
  bank_transfer: "Chuyển khoản",
};

function formatDate(s: string): string {
  return new Date(s).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<"confirming" | "paid" | "all">("confirming");
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/admin/orders?filter=${filter}`);
        if (r.ok) {
          const data = await r.json();
          setOrders(data.orders ?? []);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filter]);

  const handleConfirm = async (orderCode: string) => {
    if (!confirm("Xác nhận đơn hàng này?")) return;
    setConfirming(orderCode);
    try {
      const r = await fetch("/api/admin/confirm-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_code: orderCode }),
      });
      if (r.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.order_code === orderCode
              ? { ...o, payment_status: "paid" }
              : o
          )
        );
      } else {
        const data = await r.json();
        alert(data.error || "Lỗi xác nhận.");
      }
    } finally {
      setConfirming(null);
    }
  };

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-primary">
        Quản lý đơn hàng
      </h1>

      <div className="mt-6 flex gap-2">
        {(["confirming", "paid", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              filter === f
                ? "bg-primary text-white"
                : "bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {f === "confirming"
              ? "Chờ xác nhận"
              : f === "paid"
                ? "Đã thanh toán"
                : "Tất cả"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 py-12 text-center text-neutral-500">
          Đang tải...
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-8 py-12 text-center text-neutral-500">
          Không có đơn hàng
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-4 py-3 text-left font-medium">Ngày</th>
                <th className="px-4 py-3 text-left font-medium">Mã đơn</th>
                <th className="px-4 py-3 text-left font-medium">Tên</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">SĐT</th>
                <th className="px-4 py-3 text-left font-medium">Gói</th>
                <th className="px-4 py-3 text-right font-medium">Số tiền</th>
                <th className="px-4 py-3 text-left font-medium">PT</th>
                <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
                <th className="px-4 py-3 text-left font-medium">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-600">
                    {formatDate(o.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono font-medium">
                    {o.order_code}
                  </td>
                  <td className="px-4 py-3">{o.full_name || "–"}</td>
                  <td className="px-4 py-3">{o.email || "–"}</td>
                  <td className="px-4 py-3">{o.phone || "–"}</td>
                  <td className="px-4 py-3">{o.program}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                    {formatPrice(o.amount)}
                  </td>
                  <td className="px-4 py-3">
                    {PM_LABELS[o.payment_method] ?? o.payment_method}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_CLASS[o.payment_status] ?? "bg-neutral-100"
                      }`}
                    >
                      {STATUS_LABELS[o.payment_status] ?? o.payment_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {o.payment_status === "confirming" && (
                      <button
                        type="button"
                        onClick={() => handleConfirm(o.order_code)}
                        disabled={confirming !== null}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {confirming === o.order_code
                          ? "Đang xử lý..."
                          : "✅ Xác nhận"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
