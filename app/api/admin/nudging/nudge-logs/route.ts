import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const verified = await verifyAdmin();
  if (verified.error) return verified.error;

  const { searchParams } = new URL(request.url);
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
  const nudgeType = searchParams.get("nudge_type") || undefined;
  const channel = searchParams.get("channel") || undefined;
  const dateFrom = searchParams.get("date_from") || undefined;
  const dateTo = searchParams.get("date_to") || undefined;

  const supabase = createServiceClient();

  let q = supabase
    .from("nudge_logs")
    .select(
      "id, user_id, nudge_type, channel, content_template, sent_at, delivered, opened, led_to_checkin",
      { count: "exact" }
    )
    .order("sent_at", { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (nudgeType) q = q.eq("nudge_type", nudgeType);
  if (channel) q = q.eq("channel", channel);
  if (dateFrom) q = q.gte("sent_at", dateFrom + "T00:00:00.000Z");
  if (dateTo) q = q.lte("sent_at", dateTo + "T23:59:59.999Z");

  const { data, error, count } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userIds = [...new Set((data ?? []).map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);
  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name?.trim() || p.email || "–"])
  );

  const rows = (data ?? []).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    userName: profileMap.get(r.user_id) ?? "–",
    nudge_type: r.nudge_type,
    channel: r.channel,
    sent_at: r.sent_at,
    delivered: r.delivered,
    opened: r.opened,
    led_to_checkin: r.led_to_checkin,
  }));

  return NextResponse.json({
    rows,
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  });
}
