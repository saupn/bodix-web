import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PaymentIssuesList, type IssueRow } from "./payment-issues-list";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/app");

  const service = createServiceClient();

  const { data: events } = await service
    .from("sepay_webhook_events")
    .select(
      "id, sepay_id, payment_code, content, transfer_amount, status, error_message, matched_order_id, received_at, raw_payload",
    )
    .in("status", ["error", "unmatched"])
    .order("received_at", { ascending: false })
    .limit(100);

  const orderIds = Array.from(
    new Set(
      (events ?? [])
        .map((e) => e.matched_order_id)
        .filter((id): id is number => id != null),
    ),
  );

  const orderMap = new Map<
    number,
    { payment_code: string | null; amount: number; user_id: string | null }
  >();
  if (orderIds.length > 0) {
    const { data: orders } = await service
      .from("orders")
      .select("id, payment_code, amount, user_id")
      .in("id", orderIds);
    for (const o of orders ?? []) {
      orderMap.set(o.id, {
        payment_code: o.payment_code,
        amount: o.amount,
        user_id: o.user_id,
      });
    }
  }

  const userIds = Array.from(
    new Set(
      Array.from(orderMap.values())
        .map((o) => o.user_id)
        .filter((u): u is string => Boolean(u)),
    ),
  );
  const userMap = new Map<string, { full_name: string | null; phone: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await service
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      userMap.set(p.id, { full_name: p.full_name, phone: p.phone });
    }
  }

  const issues: IssueRow[] = (events ?? []).map((e) => {
    const order = e.matched_order_id ? orderMap.get(e.matched_order_id) : null;
    const userInfo = order?.user_id ? userMap.get(order.user_id) : null;

    let kind: IssueRow["kind"] = "other";
    if (e.status === "unmatched") {
      kind = "unmatched";
    } else if (e.error_message?.toLowerCase().includes("underpaid")) {
      kind = "underpaid";
    } else if (e.error_message?.toLowerCase().includes("overpaid")) {
      kind = "overpaid";
    }

    return {
      id: e.id,
      sepay_id: e.sepay_id,
      payment_code: e.payment_code,
      content: e.content,
      transfer_amount: e.transfer_amount,
      status: e.status,
      error_message: e.error_message,
      received_at: e.received_at,
      matched_order_id: e.matched_order_id,
      kind,
      order_payment_code: order?.payment_code ?? null,
      order_amount: order?.amount ?? null,
      user_name: userInfo?.full_name ?? null,
      user_phone: userInfo?.phone ?? null,
    };
  });

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin" className="text-sm text-primary hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-3 font-heading text-2xl font-bold text-primary">
          Thanh toán cần xử lý
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Webhook events bị lỗi: thiếu/dư tiền hoặc không khớp đơn nào.
        </p>

        <PaymentIssuesList issues={issues} />
      </div>
    </div>
  );
}
