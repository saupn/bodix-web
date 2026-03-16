import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
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

  const filter = request.nextUrl.searchParams.get("filter") || "confirming";

  const service = createServiceClient();

  let query = service
    .from("orders")
    .select(
      `
      id, order_code, user_id, program, amount, payment_method, payment_status,
      created_at, confirmed_at
    `
    )
    .order("created_at", { ascending: false });

  if (filter === "confirming") {
    query = query.eq("payment_status", "confirming");
  } else if (filter === "paid") {
    query = query.eq("payment_status", "paid");
  }

  const { data: orders, error } = await query;

  if (error) {
    console.error("[admin/orders]", error);
    return NextResponse.json(
      { error: "Không thể tải đơn hàng." },
      { status: 500 }
    );
  }

  // Get user emails (service client has auth.admin)
  const userIds = [...new Set((orders ?? []).map((o: { user_id: string | null }) => o.user_id).filter(Boolean))] as string[];
  const emails: Record<string, string> = {};
  for (const uid of userIds) {
    try {
      const { data: authUser } = await service.auth.admin.getUserById(uid);
      if (authUser?.user?.email) emails[uid] = authUser.user.email;
    } catch {
      /* ignore */
    }
  }

  // Fetch profiles for user_ids
  let profiles: { id: string; full_name: string | null; phone: string | null }[] = [];
  if (userIds.length > 0) {
    const { data } = await service
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", userIds);
    profiles = data ?? [];
  }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const enriched = (orders ?? []).map((o: { user_id: string | null }) => {
    const p = o.user_id ? profileMap.get(o.user_id) : null;
    return {
      ...o,
      email: o.user_id ? emails[o.user_id] ?? "" : "",
      full_name: p?.full_name ?? "",
      phone: p?.phone ?? "",
    };
  });

  return NextResponse.json({ orders: enriched });
}
