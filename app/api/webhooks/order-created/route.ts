import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/admin/notify-admins";
import { PROGRAMS, formatPrice, type ProgramSlug } from "@/lib/config/pricing";

/**
 * Supabase Database Webhook handler — INSERT trên `orders`.
 *
 * Trigger setup: migration 044 (pg_net) hoặc Supabase Dashboard → Database
 * Webhooks → POST tới URL này với header `Authorization: Bearer <CRON_SECRET>`.
 *
 * Bắn push admin với title "Đơn hàng mới" mỗi khi có order INSERT.
 */
interface OrderRow {
  id: number | string;
  order_code: string | null;
  user_id: string | null;
  program: string | null;
  amount: number | null;
}

interface SupabaseWebhookPayload {
  type?: string;
  table?: string;
  record?: OrderRow;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: SupabaseWebhookPayload;
  try {
    payload = (await request.json()) as SupabaseWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.type !== "INSERT" || !payload.record) {
    return NextResponse.json({ skipped: "not_insert" });
  }

  const order = payload.record;

  let userName = "Khách";
  if (order.user_id) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", order.user_id)
      .maybeSingle();
    if (profile?.full_name?.trim()) userName = profile.full_name.trim();
  }

  const programName =
    PROGRAMS[order.program as ProgramSlug]?.name ?? order.program ?? "—";
  const priceLabel =
    typeof order.amount === "number" ? formatPrice(order.amount) : "—";

  const result = await notifyAdmins({
    type: "system",
    title: "Đơn hàng mới",
    body: `${userName} — ${programName} — ${priceLabel}`,
    data: {
      kind: "order_created",
      order_id: String(order.id),
      order_code: order.order_code ?? "",
      user_id: order.user_id ?? "",
    },
  });

  return NextResponse.json({ ok: true, ...result });
}
