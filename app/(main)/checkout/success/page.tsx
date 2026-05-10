import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { formatDateVn } from "@/lib/date/vietnam";

const PROGRAM_NAME: Record<string, string> = {
  "bodix-21": "BodiX 21",
  "bodix-6w": "BodiX 6W",
  "bodix-12w": "BodiX 12W",
  bodix21: "BodiX 21",
  bodix6w: "BodiX 6W",
  bodix12w: "BodiX 12W",
};

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderParam } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let programLabel = "chương trình";
  let programSlug: string | null = null;
  if (orderParam) {
    const numericId = Number(orderParam);
    if (Number.isFinite(numericId) && numericId > 0) {
      const service = createServiceClient();
      const { data: order } = await service
        .from("orders")
        .select("user_id, program, payment_status")
        .eq("id", numericId)
        .maybeSingle();

      if (order && order.user_id === user.id) {
        programLabel = PROGRAM_NAME[order.program] ?? order.program;
        programSlug = order.program;
      }
    }
  }

  // Tìm cohort upcoming gần nhất cho program này
  let cohortName: string | null = null;
  let cohortStartDate: string | null = null;
  if (programSlug) {
    const { data: program } = await supabase
      .from("programs")
      .select("id")
      .eq("slug", programSlug)
      .maybeSingle();
    if (program?.id) {
      const todayStr = new Date().toISOString().split("T")[0];
      const { data: cohort } = await supabase
        .from("cohorts")
        .select("name, start_date")
        .eq("program_id", program.id)
        .eq("status", "upcoming")
        .gte("start_date", todayStr)
        .order("start_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      cohortName = cohort?.name ?? null;
      cohortStartDate = cohort?.start_date ?? null;
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-green-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="mt-5 font-heading text-2xl font-bold text-primary">
          Thanh toán thành công!
        </h1>
        <p className="mt-3 text-neutral-600">
          Tài khoản đã được kích hoạt cho{" "}
          <span className="font-semibold text-neutral-800">{programLabel}</span>
          .
        </p>
        {cohortName && cohortStartDate ? (
          <p className="mt-3 text-sm text-neutral-700">
            Đợt tập sắp tới:{" "}
            <span className="font-semibold text-primary">{cohortName}</span> –
            bắt đầu ngày{" "}
            <span className="font-semibold text-primary">
              {formatDateVn(cohortStartDate)}
            </span>
            . Bạn sẽ nhận thông báo qua Zalo trước khi đợt mở.
          </p>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">
            Bạn sẽ nhận thông báo khi đợt tập tiếp theo mở (thường trong 1-2
            tuần).
          </p>
        )}

        <Link
          href="/app"
          className="mt-8 inline-block w-full rounded-xl bg-primary py-3.5 font-semibold text-white hover:bg-primary-dark"
        >
          Về Dashboard
        </Link>
      </div>
    </div>
  );
}
