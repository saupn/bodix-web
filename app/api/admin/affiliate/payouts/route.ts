import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return data?.role === "admin";
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  if (!(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const year = parseInt(params.get("year") ?? String(new Date().getFullYear()), 10);
  const limit = 12;

  const service = createServiceClient();

  const { data: withdrawals, error } = await service
    .from("user_credits")
    .select("id, user_id, amount, created_at")
    .eq("transaction_type", "withdrawal")
    .eq("withdrawal_status", "paid")
    .gte("created_at", `${year}-01-01`)
    .lt("created_at", `${year + 1}-01-01`)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[admin/affiliate/payouts] GET:", error);
    return NextResponse.json({ error: "Lỗi truy vấn." }, { status: 500 });
  }

  const byMonth = new Map<string, { total: number; count: number; items: { id: string; user_id: string; amount: number; paid_at: string }[] }>();
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    byMonth.set(key, { total: 0, count: 0, items: [] });
  }

  for (const w of withdrawals ?? []) {
    const d = new Date(w.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const entry = byMonth.get(key);
    if (entry) {
      const amt = Math.abs(w.amount);
      entry.total += amt;
      entry.count += 1;
      entry.items.push({
        id: w.id,
        user_id: w.user_id,
        amount: amt,
        paid_at: w.created_at,
      });
    }
  }

  const summary = Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, data]) => ({
      month,
      label: `${month.slice(5, 7)}/${month.slice(0, 4)}`,
      total: data.total,
      count: data.count,
      items: data.items,
    }))
    .filter((s) => s.count > 0);

  const userIds = [...new Set((withdrawals ?? []).map((w) => w.user_id))];
  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const summaryWithNames = summary.map((s) => ({
    ...s,
    items: s.items.map((i) => ({
      ...i,
      affiliate_name: profileMap.get(i.user_id)?.full_name ?? "–",
    })),
  }));

  return NextResponse.json({
    year,
    summary: summaryWithNames,
    grand_total: summaryWithNames.reduce((s, m) => s + m.total, 0),
  });
}
