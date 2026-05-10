import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Returns the user's most recent pending order. Optionally filtered by program slug.
 * Used by:
 *  - Dashboard banner: detect pending payment to show CTA.
 *  - Checkout page: resume payment for an existing pending order.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = request.nextUrl.searchParams.get("slug");

  const service = createServiceClient();
  let query = service
    .from("orders")
    .select(
      "id, program, amount, payment_status, payment_code, sepay_paid_at, created_at",
    )
    .eq("user_id", user.id)
    .eq("payment_status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  if (slug) {
    query = query.eq("program", slug);
  }

  const { data: order } = await query.maybeSingle();

  if (!order || !order.payment_code) {
    return NextResponse.json({ pending: false });
  }

  return NextResponse.json({
    pending: true,
    order: {
      id: order.id,
      program: order.program,
      amount: order.amount,
      payment_code: order.payment_code,
    },
  });
}
