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
  const statusFilter = params.get("status"); // pending | paid | rejected | all
  const page = Math.max(0, parseInt(params.get("page") ?? "0", 10));
  const limit = 50;

  const service = createServiceClient();

  let query = service
    .from("user_credits")
    .select("id, user_id, amount, description, created_at, withdrawal_status")
    .eq("transaction_type", "withdrawal")
    .order("created_at", { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (statusFilter === "pending") {
    query = query.or("withdrawal_status.is.null,withdrawal_status.eq.pending");
  } else if (statusFilter === "paid") {
    query = query.eq("withdrawal_status", "paid");
  } else if (statusFilter === "rejected") {
    query = query.eq("withdrawal_status", "rejected");
  }

  const { data: withdrawals, error } = await query;

  if (error) {
    console.error("[admin/affiliate/withdrawals] GET:", error);
    return NextResponse.json({ error: "Lỗi truy vấn." }, { status: 500 });
  }

  if (!withdrawals?.length) {
    return NextResponse.json({ withdrawals: [], page, has_more: false });
  }

  const userIds = [...new Set(withdrawals.map((w) => w.user_id))];
  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const { data: affiliateProfiles } = await service
    .from("affiliate_profiles")
    .select("user_id, bank_name, bank_account_number, bank_account_name")
    .in("user_id", userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const bankMap = new Map((affiliateProfiles ?? []).map((a) => [a.user_id, a]));

  const rows = withdrawals.map((w) => {
    const profile = profileMap.get(w.user_id);
    const bank = bankMap.get(w.user_id);
    const status = w.withdrawal_status ?? "pending";
    return {
      id: w.id,
      affiliate_name: profile?.full_name ?? "–",
      user_id: w.user_id,
      amount: Math.abs(w.amount),
      bank_name: bank?.bank_name ?? "–",
      bank_account: bank?.bank_account_number ?? "–",
      bank_account_name: bank?.bank_account_name ?? "–",
      requested_at: w.created_at,
      status,
    };
  });

  return NextResponse.json({
    withdrawals: rows,
    page,
    has_more: withdrawals.length === limit,
  });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  if (!(await requireAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }

  let body: { withdrawal_id: string; action: "approve" | "reject"; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { withdrawal_id, action, reason } = body;

  if (!withdrawal_id) {
    return NextResponse.json({ error: "Thiếu withdrawal_id." }, { status: 400 });
  }
  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action phải là approve hoặc reject." }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: withdrawal, error: fetchError } = await service
    .from("user_credits")
    .select("id, user_id, amount, withdrawal_status")
    .eq("id", withdrawal_id)
    .eq("transaction_type", "withdrawal")
    .single();

  if (fetchError || !withdrawal) {
    return NextResponse.json({ error: "Không tìm thấy yêu cầu rút tiền." }, { status: 404 });
  }

  const currentStatus = withdrawal.withdrawal_status ?? "pending";
  if (currentStatus !== "pending") {
    return NextResponse.json({ error: "Yêu cầu đã được xử lý." }, { status: 400 });
  }

  if (action === "reject") {
    const { data: affiliate } = await service
      .from("affiliate_profiles")
      .select("id, pending_balance")
      .eq("user_id", withdrawal.user_id)
      .single();

    if (affiliate) {
      const refundAmount = Math.abs(withdrawal.amount);
      const newBalance = (affiliate.pending_balance ?? 0) + refundAmount;
      await service
        .from("affiliate_profiles")
        .update({
          pending_balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", affiliate.id);
    }

    await service
      .from("user_credits")
      .update({ withdrawal_status: "rejected" })
      .eq("id", withdrawal_id);

    await service.from("notifications").insert({
      user_id: withdrawal.user_id,
      type: "affiliate_withdrawal_rejected",
      channel: "in_app",
      title: "Yêu cầu rút tiền không được chấp nhận",
      content: reason?.trim() || "Yêu cầu rút tiền của bạn không được chấp nhận. Số dư đã được hoàn lại.",
      metadata: { action_url: "/app/affiliate" },
    });

    return NextResponse.json({ status: "rejected", withdrawal_id });
  }

  await service
    .from("user_credits")
    .update({ withdrawal_status: "paid" })
    .eq("id", withdrawal_id);

  const { data: affiliate } = await service
    .from("affiliate_profiles")
    .select("total_paid")
    .eq("user_id", withdrawal.user_id)
    .single();

  if (affiliate) {
    const paidAmount = Math.abs(withdrawal.amount);
    const newTotalPaid = (affiliate.total_paid ?? 0) + paidAmount;
    await service
      .from("affiliate_profiles")
      .update({
        total_paid: newTotalPaid,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", withdrawal.user_id);
  }

  await service.from("notifications").insert({
    user_id: withdrawal.user_id,
    type: "affiliate_withdrawal_paid",
    channel: "in_app",
    title: "Đã chuyển khoản",
    content: `Yêu cầu rút ${Math.abs(withdrawal.amount).toLocaleString("vi-VN")}đ đã được xử lý.`,
    metadata: { action_url: "/app/affiliate" },
  });

  return NextResponse.json({ status: "paid", withdrawal_id });
}
