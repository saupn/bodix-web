import Link from "next/link";

type InvalidReason = "not_found" | "inactive" | "expired" | "exhausted";

interface InvalidReferralPageProps {
  code: string;
  reason: InvalidReason;
}

const REASON_TEXT: Record<InvalidReason, { title: string; body: string }> = {
  not_found: {
    title: "Mã giới thiệu không tồn tại",
    body: "Mã bạn truy cập không có trong hệ thống. Có thể bạn gõ nhầm hoặc đường dẫn bị cắt ngắn khi sao chép.",
  },
  inactive: {
    title: "Mã giới thiệu đã tạm ngưng",
    body: "Người giới thiệu đã tạm ngưng mã này. Bạn vẫn có thể đăng ký tập thử miễn phí 3 ngày bên dưới.",
  },
  expired: {
    title: "Mã giới thiệu đã hết hạn",
    body: "Mã đã quá thời hạn sử dụng. Bạn vẫn có thể đăng ký tập thử miễn phí 3 ngày bên dưới.",
  },
  exhausted: {
    title: "Mã giới thiệu đã dùng hết lượt",
    body: "Mã đã đạt giới hạn số lượt sử dụng. Bạn vẫn có thể đăng ký tập thử miễn phí 3 ngày bên dưới.",
  },
};

const PROGRAMS = [
  {
    slug: "bodix-21",
    name: "BodiX 21",
    duration: "21 ngày",
    blurb: "Khởi động – cơ thể bắt đầu thay đổi.",
  },
  {
    slug: "bodix-6w",
    name: "BodiX 6W",
    duration: "6 tuần",
    blurb: "Thói quen ổn định, sức bền lên rõ.",
  },
  {
    slug: "bodix-12w",
    name: "BodiX 12W",
    duration: "12 tuần",
    blurb: "Chuyển hoá toàn diện – thân và tâm.",
  },
];

export function InvalidReferralPage({ code, reason }: InvalidReferralPageProps) {
  const { title, body } = REASON_TEXT[reason];

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:py-24">
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Mã: <span className="font-mono text-neutral-700">{code}</span>
          </p>
          <h1 className="font-heading mt-3 text-2xl font-bold text-primary sm:text-3xl">
            {title}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-neutral-600">
            {body}
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/onboarding"
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary-dark sm:w-auto"
            >
              Đăng ký tập thử miễn phí 3 ngày
            </Link>
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center rounded-lg border border-neutral-300 px-6 py-3 font-medium text-neutral-700 transition-colors hover:border-primary hover:text-primary sm:w-auto"
            >
              Xem các chương trình
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="font-heading text-center text-xl font-semibold text-primary sm:text-2xl">
          BodiX – Completion-first
        </h2>
        <p className="mt-2 text-center text-sm text-neutral-500">
          Ba chương trình, một triết lý: hoàn thành mỗi ngày quan trọng hơn cường độ.
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {PROGRAMS.map((p) => (
            <div
              key={p.slug}
              className="rounded-xl border-2 border-neutral-200 bg-white p-6 shadow-sm transition-shadow hover:border-primary/30 hover:shadow-md"
            >
              <h3 className="font-heading text-lg font-semibold text-primary">
                {p.name}
              </h3>
              <p className="mt-1 text-sm font-medium text-accent">{p.duration}</p>
              <p className="mt-3 text-sm text-neutral-600">{p.blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
