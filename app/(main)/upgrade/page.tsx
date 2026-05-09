import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

interface ProgramRow {
  id: string;
  slug: string;
  name: string;
  price_vnd: number;
  duration_days: number;
  description: string | null;
}

const PROGRAM_FEATURES: Record<string, string[]> = {
  "bodix-21": [
    "21 buổi tập 25 phút/ngày",
    "3 mức cường độ (Hard / Light / Easy)",
    "Tin nhắn nhắc tập mỗi sáng",
    "Cộng đồng đợt tập + Buddy ghép cặp",
    "Video review hàng tuần",
  ],
  "bodix-6w": [
    "Tất cả tính năng BodiX 21",
    "42 buổi tập progressive",
    "Nutrition protocol đi kèm",
    "Mid-program review chuyên sâu",
    "Buddy & cohort dài hạn",
    "Dashboard tiến trình chi tiết",
  ],
  "bodix-12w": [
    "Tất cả tính năng BodiX 6W",
    "84 buổi tập có kiểm soát",
    "Re-run có điều kiện",
    "1:1 review điểm gãy",
    "Certificate hoàn thành",
    "Alumni community",
  ],
};

const PROGRAM_TAGLINES: Record<string, string> = {
  "bodix-21": "Khởi đầu hành trình — hoàn thành lần đầu",
  "bodix-6w": "Thấy thay đổi rõ rệt — cơ thể bắt đầu khác",
  "bodix-12w": "Lột xác hoàn toàn — Signature transformation",
};

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

function durationLabel(days: number): string {
  if (days === 21) return "21 ngày";
  if (days === 42) return "6 tuần";
  if (days === 84) return "12 tuần";
  return `${days} ngày`;
}

export default async function UpgradePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/upgrade");

  const service = createServiceClient();

  const [{ data: programs }, { data: completed }, { data: activeEnrollment }] =
    await Promise.all([
      service
        .from("programs")
        .select("id, slug, name, price_vnd, duration_days, description")
        .eq("is_active", true)
        .order("price_vnd", { ascending: true }),
      service
        .from("enrollments")
        .select("program_id, completed_at, programs!program_id(slug)")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false }),
      service
        .from("enrollments")
        .select("id, status, program_id, programs!program_id(slug, name)")
        .eq("user_id", user.id)
        .in("status", ["active", "paid_waiting_cohort", "pending_payment"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const programList = (programs ?? []) as ProgramRow[];
  const programBySlug = new Map(programList.map((p) => [p.slug, p]));

  const completedSlugs = new Set(
    (completed ?? [])
      .map((c) => {
        const prog = Array.isArray(c.programs) ? c.programs[0] : c.programs;
        return prog?.slug;
      })
      .filter((s): s is string => Boolean(s)),
  );

  // Có chương trình đang chạy?
  const active = activeEnrollment as
    | { status: string; programs: { slug: string; name: string } | { slug: string; name: string }[] | null }
    | null;
  const activeProgram = active
    ? Array.isArray(active.programs)
      ? active.programs[0]
      : active.programs
    : null;

  if (active && active.status === "active") {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <h1 className="font-heading text-xl font-bold text-amber-900">
            Bạn đang trong chương trình
          </h1>
          <p className="mt-3 text-amber-800">
            Hãy hoàn thành{" "}
            <span className="font-semibold">{activeProgram?.name ?? "chương trình hiện tại"}</span>{" "}
            trước khi nâng cấp.
          </p>
          <Link
            href="/app"
            className="mt-6 inline-block rounded-xl bg-amber-700 px-5 py-2.5 font-semibold text-white hover:bg-amber-800"
          >
            Về Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Đề xuất gói tiếp theo
  let recommendedSlugs: string[];
  if (!completedSlugs.has("bodix-21")) {
    recommendedSlugs = ["bodix-21"];
  } else if (!completedSlugs.has("bodix-6w")) {
    recommendedSlugs = ["bodix-6w", "bodix-12w"];
  } else if (!completedSlugs.has("bodix-12w")) {
    recommendedSlugs = ["bodix-12w"];
  } else {
    recommendedSlugs = ["bodix-12w"]; // re-run
  }

  const recommended = recommendedSlugs
    .map((s) => programBySlug.get(s))
    .filter((p): p is ProgramRow => Boolean(p));

  const isRerun =
    completedSlugs.has("bodix-12w") && recommendedSlugs[0] === "bodix-12w";

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
        {isRerun ? "Cảm ơn bạn đã đồng hành!" : "Bước tiếp theo của bạn"}
      </h1>
      <p className="mt-2 text-neutral-600">
        {isRerun
          ? "Bạn đã hoàn thành BodiX 12W. Có thể chạy lại để giữ phong độ."
          : completedSlugs.size > 0
            ? `Đã hoàn thành ${completedSlugs.size} chương trình. Đề xuất gói tiếp theo:`
            : "Chọn chương trình phù hợp với mục tiêu của bạn."}
      </p>

      <div
        className={`mt-8 grid gap-6 ${recommended.length === 1 ? "max-w-md" : "sm:grid-cols-2"}`}
      >
        {recommended.map((p, idx) => {
          const features = PROGRAM_FEATURES[p.slug] ?? [];
          const tagline = PROGRAM_TAGLINES[p.slug] ?? p.description ?? "";
          const isPrimary = idx === 0;
          return (
            <div
              key={p.slug}
              className={`relative rounded-2xl border-2 p-6 ${
                isPrimary
                  ? "border-primary bg-white shadow-lg"
                  : "border-neutral-200 bg-white"
              }`}
            >
              {isPrimary && (
                <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                  Đề xuất cho bạn
                </span>
              )}
              <h3 className="font-heading text-xl font-bold text-primary">
                {p.name}
              </h3>
              <p className="mt-1 text-sm font-medium text-accent">
                {durationLabel(p.duration_days)}
              </p>
              {tagline && (
                <p className="mt-2 text-sm text-neutral-600">{tagline}</p>
              )}
              <p className="mt-4 text-3xl font-bold text-primary">
                {formatVnd(p.price_vnd)}
              </p>
              <ul className="mt-5 space-y-1.5">
                {features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-neutral-600">
                    <span className="text-primary">•</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={`/app/checkout/${p.slug}`}
                className={`mt-6 block w-full rounded-xl py-3 text-center font-semibold transition-colors ${
                  isPrimary
                    ? "bg-primary text-white hover:bg-primary-dark"
                    : "border border-primary text-primary hover:bg-primary/5"
                }`}
              >
                {isRerun ? "Đăng ký lại" : "Đăng ký nâng cấp"}
              </Link>
            </div>
          );
        })}
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/app"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Về Dashboard
        </Link>
      </div>
    </div>
  );
}
