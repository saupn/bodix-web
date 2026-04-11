import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PROGRAMS, type ProgramSlug } from "@/lib/config/pricing";

const VALID_PROGRAMS: ProgramSlug[] = ["bodix21", "bodix6w", "bodix12w"];
const VALID_METHODS = ["momo", "bank_transfer"] as const;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Chưa đăng nhập." },
      { status: 401 }
    );
  }

  let body: {
    order_code?: string;
    program?: string;
    amount?: number;
    payment_method?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const orderCode = body.order_code?.trim();
  const programSlug = body.program?.trim();
  const amount = body.amount;
  const paymentMethod = body.payment_method?.trim();

  if (!orderCode) {
    return NextResponse.json(
      { error: "Thiếu order_code." },
      { status: 400 }
    );
  }
  if (!VALID_PROGRAMS.includes(programSlug as ProgramSlug)) {
    return NextResponse.json(
      { error: "Chương trình không hợp lệ." },
      { status: 400 }
    );
  }
  if (typeof amount !== "number" || amount !== PROGRAMS[programSlug as ProgramSlug].price) {
    return NextResponse.json(
      { error: "Số tiền không khớp." },
      { status: 400 }
    );
  }
  if (!paymentMethod || !VALID_METHODS.includes(paymentMethod as (typeof VALID_METHODS)[number])) {
    return NextResponse.json(
      { error: "Phương thức thanh toán không hợp lệ." },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  const { error: insertError } = await service.from("orders").insert({
    order_code: orderCode,
    user_id: user.id,
    program: programSlug,
    amount,
    payment_method: paymentMethod,
    payment_status: "pending",
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "Mã đơn đã tồn tại. Vui lòng dùng mã mới." },
        { status: 409 }
      );
    }
    console.error("[confirm-transfer]", insertError);
    return NextResponse.json(
      { error: "Không thể tạo đơn hàng." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
