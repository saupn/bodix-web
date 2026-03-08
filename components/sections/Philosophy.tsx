import { SectionHeading } from "@/components/ui/SectionHeading";

const cards = [
  {
    emoji: "📋",
    title: "Có lộ trình rõ ràng",
    description:
      "Không phải \"tập khi có hứng\". Mỗi ngày bạn biết chính xác tập gì, bao lâu, ở cường độ nào.",
  },
  {
    emoji: "👥",
    title: "Không tập một mình",
    description:
      "Bạn tập cùng đợt với những người khác. Thấy họ hoàn thành — bạn cũng muốn hoàn thành.",
  },
  {
    emoji: "🆘",
    title: "Có người giữ bạn ở lại",
    description:
      "Ngày mệt? Chọn Easy chỉ 10 phút. Bỏ 2 ngày? Hệ thống nhắn nhẹ qua Zalo. Không bao giờ để bạn bỏ cuộc.",
  },
  {
    emoji: "✅",
    title: "Đo được, thấy được",
    description:
      "Check-in mỗi ngày. Streak tích lũy. Review mỗi Chủ nhật. Bạn THẤY mình đang tiến lên.",
  },
];

export function Philosophy() {
  return (
    <section id="why-different" className="py-12 md:py-20 lg:py-24 bg-secondary">
      <div className="container mx-auto px-4 sm:px-6">
        <SectionHeading
          title="Vì sao 90% người tập bỏ giữa chừng — và BodiX giải quyết điều đó"
        />
        <div className="mt-8 sm:mt-12 grid gap-6 sm:gap-8 sm:grid-cols-2 md:grid-cols-4">
          {cards.map(({ emoji, title, description }) => (
            <div
              key={title}
              className="rounded-xl bg-white p-4 sm:p-6 border border-neutral-200 shadow-sm"
            >
              <span className="text-4xl">{emoji}</span>
              <h3 className="mt-4 font-heading text-lg font-semibold text-primary">
                {title}
              </h3>
              <p className="mt-2 text-neutral-600 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
