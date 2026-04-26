import { SectionHeading } from "@/components/ui/SectionHeading";

const steps = [
  {
    emoji: "💪",
    title: "Thứ 2–6: Phiên tập chính",
    description:
      "Chọn Hard (3 lượt, 25 phút), Light (2 lượt, 18 phút), hoặc Easy (1 lượt, 10 phút) – tùy cảm giác hôm đó.",
  },
  {
    emoji: "🧘",
    title: "Thứ 7: Phiên phục hồi",
    description:
      "Stretching nhẹ nhàng, 15 phút. Cơ thể cần nghỉ để mạnh hơn.",
  },
  {
    emoji: "📊",
    title: "Chủ nhật: Review tuần",
    description:
      "Xem video nhận xét, lắng nghe cơ thể, đặt mục tiêu tuần mới. ~20-30 phút.",
  },
  {
    emoji: "🔥",
    title: "Mỗi ngày: Check-in hàng ngày & Streak",
    description:
      "Check-in → Streak tích lũy → Cộng đồng thấy bạn hoàn thành. Nhịp đều đặn tạo kết quả.",
  },
];

export function Problems() {
  return (
    <section className="py-12 md:py-20 lg:py-24 bg-neutral-50">
      <div className="container mx-auto px-4 sm:px-6">
        <SectionHeading title="Một tuần trong BodiX" />
        <div className="mt-8 sm:mt-12 grid gap-6 sm:gap-8 sm:grid-cols-2 md:grid-cols-4">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="relative rounded-xl bg-white p-4 sm:p-6 border border-neutral-200 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{step.emoji}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-4 font-heading text-sm sm:text-base font-semibold text-primary">
                {step.title}
              </h3>
              <p className="mt-3 text-sm text-neutral-800 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
