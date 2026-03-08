import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TrialStartButton } from "@/components/dashboard/TrialStartButton";

const BADGE_BY_SLUG: Record<string, string> = {
  "bodix-21": "🚀 Bắt đầu từ đây",
  "bodix-6w": "💪 Kết quả rõ rệt",
  "bodix-12w": "🔥 Lột xác toàn diện",
};

function formatDuration(days: number): string {
  if (days === 21) return "21 ngày";
  if (days === 42) return "6 tuần";
  if (days === 84) return "12 tuần";
  return `${days} ngày`;
}

interface Program {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_days: number;
}

export default async function ProgramsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (enrollment) {
    redirect("/app");
  }

  const { data: programs, error } = await supabase
    .from("programs")
    .select("id, slug, name, description, duration_days")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !programs?.length) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
          Chương trình
        </h1>
        <p className="mt-4 text-neutral-600">
          Không thể tải danh sách chương trình. Vui lòng thử lại sau.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
        Chọn chương trình bạn muốn trải nghiệm
      </h1>
      <p className="mt-2 text-neutral-600">
        Bạn có 3 ngày dùng thử miễn phí
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {programs.map((p) => {
          const badge = BADGE_BY_SLUG[p.slug] ?? "";
          const isHighlight = p.slug === "bodix-21";

          return (
            <div
              key={p.id}
              className={`rounded-xl border-2 bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${
                isHighlight
                  ? "border-primary/40 ring-2 ring-primary/10"
                  : "border-neutral-200 hover:border-primary/30"
              }`}
            >
              {badge && (
                <span className="inline-block rounded-full bg-secondary px-3 py-1 text-sm font-medium text-primary">
                  {badge}
                </span>
              )}
              {isHighlight && (
                <span className="ml-2 inline-block rounded-full bg-accent/20 px-3 py-1 text-sm font-medium text-accent">
                  Phổ biến nhất
                </span>
              )}

              <h3 className="mt-4 font-heading text-xl font-semibold text-primary">
                {p.name}
              </h3>
              <p className="mt-1 text-sm font-medium text-accent">
                {formatDuration(p.duration_days)}
              </p>
              <p className="mt-3 text-neutral-600 text-sm leading-relaxed">
                {p.description || ""}
              </p>

              <div className="mt-6">
                <TrialStartButton
                  programId={p.id}
                  programName={p.name}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-secondary-light transition-colors hover:bg-primary-dark disabled:opacity-60"
                >
                  Dùng thử miễn phí
                </TrialStartButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
