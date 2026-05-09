import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";

type Action = "manual_match" | "refund_done" | "underpaid_resolved";
const VALID_ACTIONS: Action[] = ["manual_match", "refund_done", "underpaid_resolved"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const auth = await verifyAdmin();
  if ("error" in auth) return auth.error;

  const { eventId: rawEventId } = await params;
  const eventId = Number(rawEventId);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "eventId không hợp lệ." }, { status: 400 });
  }

  let body: { action?: unknown; order_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const action = body.action as Action;
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `action phải là một trong: ${VALID_ACTIONS.join(", ")}` },
      { status: 400 },
    );
  }

  const service = createServiceClient();

  const { data: event } = await service
    .from("sepay_webhook_events")
    .select("id, sepay_id, transfer_amount, payment_code, status, matched_order_id, error_message")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ error: "Event không tồn tại." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const adminNote = `[admin ${auth.user.id.slice(0, 8)} @ ${now}]`;

  if (action === "manual_match") {
    const orderId = Number(body.order_id);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "order_id không hợp lệ." }, { status: 400 });
    }

    const { data: order } = await service
      .from("orders")
      .select("id, user_id, program, payment_status, amount")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: "Order không tồn tại." }, { status: 404 });
    }

    if (order.payment_status !== "paid") {
      await service
        .from("orders")
        .update({
          payment_status: "paid",
          confirmed_at: now,
          confirmed_by: auth.user.id,
          sepay_transaction_id: event.sepay_id ? String(event.sepay_id) : null,
          sepay_paid_at: now,
        })
        .eq("id", order.id);

      // Activate enrollment + profile (giống webhook flow)
      const { data: programRow } = await service
        .from("programs")
        .select("id")
        .eq("slug", order.program)
        .maybeSingle();

      if (programRow && order.user_id) {
        const { data: enrollment } = await service
          .from("enrollments")
          .select("id")
          .eq("user_id", order.user_id)
          .eq("program_id", programRow.id)
          .eq("status", "pending_payment")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (enrollment) {
          await service
            .from("enrollments")
            .update({
              status: "paid_waiting_cohort",
              paid_at: now,
              amount_paid: order.amount,
              payment_method: "bank_transfer",
              payment_reference: `manual_match_event_${event.id}`,
            })
            .eq("id", enrollment.id);
        }
      }

      if (order.user_id) {
        await service
          .from("profiles")
          .update({
            payment_status: "paid",
            bodix_status: "paid_waiting_cohort",
            bodix_program: order.program,
          })
          .eq("id", order.user_id);
      }
    }

    await service
      .from("sepay_webhook_events")
      .update({
        status: "matched",
        matched_order_id: orderId,
        error_message: `${adminNote} Manually matched to order ${orderId}. ${event.error_message ?? ""}`.trim(),
      })
      .eq("id", eventId);

    return NextResponse.json({ success: true, order_id: orderId });
  }

  if (action === "refund_done") {
    await service
      .from("sepay_webhook_events")
      .update({
        error_message: `${adminNote} Refund completed. ${event.error_message ?? ""}`.trim(),
      })
      .eq("id", eventId);
    return NextResponse.json({ success: true });
  }

  // underpaid_resolved
  await service
    .from("sepay_webhook_events")
    .update({
      error_message: `${adminNote} Underpaid resolved. ${event.error_message ?? ""}`.trim(),
    })
    .eq("id", eventId);
  return NextResponse.json({ success: true });
}
