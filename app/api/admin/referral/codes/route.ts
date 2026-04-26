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
  const typeFilter = params.get("type");
  const activeFilter = params.get("active");
  const search = params.get("search")?.trim();
  const page = Math.max(0, parseInt(params.get("page") ?? "0", 10));
  const limit = 50;

  const service = createServiceClient();

  let query = service
    .from("referral_codes")
    .select("id, code, user_id, code_type, total_clicks, total_signups, total_conversions, total_revenue_generated, is_active, created_at")
    .order("created_at", { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (typeFilter === "referral" || typeFilter === "affiliate") {
    query = query.eq("code_type", typeFilter);
  }
  if (activeFilter === "true") query = query.eq("is_active", true);
  if (activeFilter === "false") query = query.eq("is_active", false);

  const { data: codes, error } = await query;

  if (error) {
    console.error("[admin/referral/codes] GET:", error);
    return NextResponse.json({ error: "Lỗi truy vấn." }, { status: 500 });
  }

  if (!codes?.length) {
    return NextResponse.json({ codes: [], page, has_more: false });
  }

  const userIds = [...new Set(codes.map((c) => c.user_id))];
  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  let rows = codes.map((c) => ({
    id: c.id,
    code: c.code,
    user_id: c.user_id,
    user_name: profileMap.get(c.user_id)?.full_name ?? "–",
    code_type: c.code_type,
    clicks: c.total_clicks ?? 0,
    signups: c.total_signups ?? 0,
    conversions: c.total_conversions ?? 0,
    revenue: c.total_revenue_generated ?? 0,
    is_active: c.is_active,
    created_at: c.created_at,
  }));

  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        (r.user_name?.toLowerCase().includes(q) ?? false)
    );
  }

  return NextResponse.json({
    codes: rows,
    page,
    has_more: codes.length === limit,
  });
}
