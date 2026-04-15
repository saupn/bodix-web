import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPushToUser } from "@/lib/messaging/adapters/push";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }

  let body: { order_code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const orderCode = body.order_code?.trim();
  if (!orderCode) {
    return NextResponse.json(
      { error: "Thiếu order_code." },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  const { data: order, error: orderError } = await service
    .from("orders")
    .select("id, user_id, program, amount, payment_status")
    .eq("order_code", orderCode)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Đơn hàng không tồn tại." }, { status: 404 });
  }

  if (order.payment_status !== "confirming") {
    return NextResponse.json(
      { error: `Đơn hàng đã ở trạng thái ${order.payment_status}.` },
      { status: 422 }
    );
  }

  const now = new Date().toISOString();
  const today = now.split("T")[0];

  await service
    .from("orders")
    .update({
      payment_status: "paid",
      confirmed_at: now,
      confirmed_by: user.id,
    })
    .eq("id", order.id);

  if (order.user_id) {
    await service
      .from("profiles")
      .update({
        payment_status: "paid",
        bodix_status: "active",
        bodix_program: order.program,
        bodix_start_date: today,
        bodix_current_day: 1,
      })
      .eq("id", order.user_id);

    // App user → push notification xác nhận thanh toán. Không chặn flow nếu fail.
    try {
      await sendPushToUser(order.user_id, {
        type: "paymentConfirmed",
        title: "Thanh toán xác nhận! 🎉",
        body: "Bạn sẽ được thông báo khi đợt tập tiếp theo mở.",
        data: {
          order_id: order.id,
          program: order.program ?? "",
        },
      });
    } catch (e) {
      console.error("[confirm-order] push failed:", e);
    }
  }

  return NextResponse.json({ success: true });
}
