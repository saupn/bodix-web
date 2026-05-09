import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { extractPaymentCodeFromContent, SEPAY_CONFIG } from "@/lib/sepay";
import { sendPushToUser } from "@/lib/messaging/adapters/push";

type AmountStatus = "correct" | "overpaid" | "underpaid";

function classifyAmount(paid: number, expected: number, tolerance: number): AmountStatus {
  const diff = paid - expected;
  if (Math.abs(diff) <= tolerance) return "correct";
  return diff > 0 ? "overpaid" : "underpaid";
}

async function notifyInsufficientPayment(
  userId: string,
  paid: number,
  expected: number,
  paymentCode: string,
) {
  const missing = expected - paid;
  try {
    await sendPushToUser(userId, {
      type: "system",
      title: "Thanh toán chưa đủ",
      body: `Mình nhận được ${paid.toLocaleString("vi-VN")}đ nhưng cần ${expected.toLocaleString("vi-VN")}đ. Vui lòng chuyển thêm ${missing.toLocaleString("vi-VN")}đ với nội dung: ${paymentCode}`,
    });
  } catch (err) {
    console.error("[sepay] insufficient push:", err);
  }
}

interface SePayPayload {
  id: number;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  code?: string | null;
  content?: string;
  transferType?: "in" | "out";
  transferAmount?: number;
  referenceCode?: string;
  description?: string;
}

const ZERO_AMOUNT_TOLERANCE = 1000;

export async function POST(request: NextRequest) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  const expectedAuth = `Apikey ${SEPAY_CONFIG.apiKey}`;
  if (!SEPAY_CONFIG.apiKey || authHeader !== expectedAuth) {
    console.warn("[sepay] unauthorized webhook", {
      hasAuth: Boolean(authHeader),
      prefix: authHeader?.substring(0, 12),
    });
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  // ── 2. Parse payload ──────────────────────────────────────────────────────
  let payload: SePayPayload;
  try {
    payload = (await request.json()) as SePayPayload;
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON" },
      { status: 400 },
    );
  }

  const {
    id: sepayId,
    accountNumber,
    code,
    content = "",
    transferType,
    transferAmount,
    referenceCode,
  } = payload;

  if (!sepayId) {
    return NextResponse.json(
      { success: false, message: "Missing id" },
      { status: 400 },
    );
  }

  const service = createServiceClient();

  // ── 3. Filter: chỉ tiền vào, đúng tài khoản ───────────────────────────────
  if (transferType !== "in") {
    return NextResponse.json({ success: true, message: "Skipped: not incoming" });
  }
  if (accountNumber !== SEPAY_CONFIG.bankAccount) {
    return NextResponse.json({ success: true, message: "Skipped: wrong account" });
  }

  // ── 4. Dedupe theo sepay_id ───────────────────────────────────────────────
  const { data: existingEvent } = await service
    .from("sepay_webhook_events")
    .select("id, status")
    .eq("sepay_id", sepayId)
    .maybeSingle();

  if (existingEvent) {
    return NextResponse.json({
      success: true,
      message: "Duplicate, already processed",
    });
  }

  // ── 5. Extract payment code ───────────────────────────────────────────────
  const paymentCode =
    (code && code.trim().toUpperCase()) ||
    extractPaymentCodeFromContent(content || "") ||
    null;

  // ── 6. Helper để log event ────────────────────────────────────────────────
  type EventRow = {
    sepay_id: number;
    reference_code?: string;
    transfer_type?: string;
    transfer_amount?: number;
    account_number?: string;
    payment_code: string | null;
    content?: string;
    raw_payload: SePayPayload;
    status: "received" | "matched" | "unmatched" | "duplicate" | "error";
    matched_order_id?: number;
    error_message?: string;
  };

  const baseEvent: EventRow = {
    sepay_id: sepayId,
    reference_code: referenceCode,
    transfer_type: transferType,
    transfer_amount: transferAmount,
    account_number: accountNumber,
    payment_code: paymentCode,
    content,
    raw_payload: payload,
    status: "received",
  };

  const logEvent = async (row: EventRow) => {
    const { error } = await service.from("sepay_webhook_events").insert(row);
    if (error) console.error("[sepay] log event:", error);
  };

  if (!paymentCode) {
    await logEvent({
      ...baseEvent,
      status: "unmatched",
      error_message: "No payment code in code field or content",
    });
    return NextResponse.json({
      success: true,
      message: "No payment code, logged for manual review",
    });
  }

  // ── 7. Match order ────────────────────────────────────────────────────────
  const { data: order } = await service
    .from("orders")
    .select(
      "id, user_id, program, amount, payment_status, payment_method",
    )
    .eq("payment_code", paymentCode)
    .maybeSingle();

  if (!order) {
    await logEvent({
      ...baseEvent,
      status: "unmatched",
      error_message: `No order for code ${paymentCode}`,
    });
    return NextResponse.json({
      success: true,
      message: "Order not found, logged",
    });
  }

  if (order.payment_status === "paid") {
    await logEvent({
      ...baseEvent,
      status: "duplicate",
      matched_order_id: order.id,
      error_message: "Order already paid",
    });
    return NextResponse.json({ success: true, message: "Already paid" });
  }

  // ── 8. Phân tích chênh lệch số tiền (3 case) ──────────────────────────────
  if (typeof transferAmount !== "number") {
    await logEvent({
      ...baseEvent,
      status: "error",
      matched_order_id: order.id,
      error_message: "Missing transferAmount",
    });
    return NextResponse.json({
      success: true,
      message: "Missing amount, logged for review",
    });
  }

  const amountDiff = transferAmount - order.amount;
  const amountStatus = classifyAmount(transferAmount, order.amount, ZERO_AMOUNT_TOLERANCE);

  if (amountStatus === "underpaid") {
    await logEvent({
      ...baseEvent,
      status: "error",
      matched_order_id: order.id,
      error_message: `Amount underpaid: expected ${order.amount}, got ${transferAmount}, missing ${order.amount - transferAmount}`,
    });

    // In-app notification + push (best-effort)
    if (order.user_id) {
      const nowStr = new Date().toISOString();
      await service.from("notifications").insert({
        user_id: order.user_id,
        type: "payment_insufficient",
        channel: "in_app",
        title: "Thanh toán chưa đủ",
        content: `Mình nhận được ${transferAmount.toLocaleString("vi-VN")}đ nhưng cần ${order.amount.toLocaleString("vi-VN")}đ. Vui lòng chuyển thêm ${(order.amount - transferAmount).toLocaleString("vi-VN")}đ với nội dung: ${paymentCode}`,
        metadata: {
          order_id: order.id,
          paid: transferAmount,
          expected: order.amount,
          missing: order.amount - transferAmount,
          payment_code: paymentCode,
        },
        sent_at: nowStr,
      });

      await notifyInsufficientPayment(
        order.user_id,
        transferAmount,
        order.amount,
        paymentCode,
      );
    }

    return NextResponse.json({
      success: true,
      message: `Underpaid: paid ${transferAmount} of ${order.amount}`,
    });
  }

  // amountStatus === "correct" || "overpaid" → activate
  // ── 9. Cập nhật order → paid ──────────────────────────────────────────────
  const now = new Date().toISOString();

  try {
    const { error: orderUpdateErr } = await service
      .from("orders")
      .update({
        payment_status: "paid",
        confirmed_at: now,
        sepay_transaction_id: String(sepayId),
        sepay_paid_at: now,
        payment_method: order.payment_method ?? "bank_transfer",
        transaction_ref: referenceCode ?? null,
      })
      .eq("id", order.id);

    if (orderUpdateErr) throw orderUpdateErr;

    // ── 10. Activate enrollment (paid_waiting_cohort) ─────────────────────
    // Tìm enrollment pending_payment cho user + program slug.
    const { data: programRow } = await service
      .from("programs")
      .select("id, name")
      .eq("slug", order.program)
      .maybeSingle();

    let enrollmentId: string | null = null;
    if (programRow && order.user_id) {
      const { data: enrollment } = await service
        .from("enrollments")
        .select("id, voucher_id, voucher_discount_amount")
        .eq("user_id", order.user_id)
        .eq("program_id", programRow.id)
        .eq("status", "pending_payment")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (enrollment) {
        enrollmentId = enrollment.id;
        await service
          .from("enrollments")
          .update({
            status: "paid_waiting_cohort",
            paid_at: now,
            amount_paid: order.amount,
            payment_method: "bank_transfer",
            payment_reference: referenceCode ?? String(sepayId),
          })
          .eq("id", enrollment.id);

        // Trừ voucher (best-effort)
        if (enrollment.voucher_id && enrollment.voucher_discount_amount) {
          const { data: voucher } = await service
            .from("vouchers")
            .select("id, remaining_amount")
            .eq("id", enrollment.voucher_id)
            .maybeSingle();

          if (voucher) {
            const newRemaining = Math.max(
              0,
              voucher.remaining_amount - enrollment.voucher_discount_amount,
            );
            await service
              .from("vouchers")
              .update({
                remaining_amount: newRemaining,
                status: newRemaining <= 0 ? "used" : "active",
                used_at: newRemaining <= 0 ? now : null,
              })
              .eq("id", voucher.id);
          }
        }
      }
    }

    // ── 11. Update profile → paid_waiting_cohort ─────────────────────────
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

    // ── 12. Notification: in-app + push + Zalo (best-effort) ─────────────
    const isOverpaid = amountStatus === "overpaid";
    const overpaidNote = isOverpaid
      ? ` Bạn đã chuyển dư ${amountDiff.toLocaleString("vi-VN")}đ — mình sẽ liên hệ hoàn lại.`
      : "";

    if (order.user_id) {
      const programName = programRow?.name ?? order.program;

      await service.from("notifications").insert({
        user_id: order.user_id,
        type: "payment_confirmed",
        channel: "in_app",
        title: `Thanh toán ${programName} thành công!`,
        content: isOverpaid
          ? `Bạn đã chuyển dư ${amountDiff.toLocaleString("vi-VN")}đ — mình sẽ liên hệ hoàn lại. Bạn sẽ được thông báo khi đợt tập tiếp theo mở.`
          : "Bạn sẽ được thông báo khi đợt tập tiếp theo mở.",
        metadata: {
          order_id: order.id,
          enrollment_id: enrollmentId,
          amount_paid: transferAmount,
          amount_expected: order.amount,
          amount_diff: amountDiff,
          amount_status: amountStatus,
          source: "sepay_webhook",
        },
        sent_at: now,
      });

      // Push notification (best-effort)
      try {
        await sendPushToUser(order.user_id, {
          type: "paymentConfirmed",
          title: "Thanh toán xác nhận! 🎉",
          body: isOverpaid
            ? `Bạn đã chuyển dư ${amountDiff.toLocaleString("vi-VN")}đ — mình sẽ liên hệ hoàn lại.`
            : "Bạn sẽ được thông báo khi đợt tập tiếp theo mở.",
          data: {
            order_id: String(order.id),
            program: order.program ?? "",
          },
        });
      } catch (pushErr) {
        console.error("[sepay] push notify:", pushErr);
      }

      // Zalo (best-effort)
      try {
        const { data: profile } = await service
          .from("profiles")
          .select("channel_user_id")
          .eq("id", order.user_id)
          .maybeSingle();

        if (profile?.channel_user_id) {
          const { sendViaZalo } = await import("@/lib/messaging/adapters/zalo");
          await sendViaZalo(
            profile.channel_user_id,
            `✅ Thanh toán xác nhận!${overpaidNote} Bạn sẽ được thông báo ngày bắt đầu.`,
          );
        }
      } catch (zaloErr) {
        console.error("[sepay] zalo notify:", zaloErr);
      }
    }

    await logEvent({
      ...baseEvent,
      status: "matched",
      matched_order_id: order.id,
      error_message: isOverpaid
        ? `Overpaid by ${amountDiff} VND — refund needed`
        : undefined,
    });

    return NextResponse.json({
      success: true,
      message: isOverpaid ? "Order activated (overpaid — refund needed)" : "Order activated",
      order_id: order.id,
      enrollment_id: enrollmentId,
      amount_status: amountStatus,
      amount_diff: amountDiff,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[sepay] webhook process error:", error);
    await logEvent({
      ...baseEvent,
      status: "error",
      matched_order_id: order.id,
      error_message: message,
    });
    return NextResponse.json(
      { success: false, message },
      { status: 500 },
    );
  }
}
