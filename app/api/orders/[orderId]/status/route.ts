import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const numericId = Number(orderId);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }

  // Service client để đọc kể cả khi RLS chặn — sau đó verify user_id thủ công.
  const service = createServiceClient();
  const { data: order } = await service
    .from("orders")
    .select("user_id, payment_status, sepay_paid_at")
    .eq("id", numericId)
    .maybeSingle();

  if (!order || order.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    payment_status: order.payment_status,
    sepay_paid_at: order.sepay_paid_at,
  });
}
