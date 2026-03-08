import { SectionHeading } from "@/components/ui/SectionHeading";

const problems = [
  {
    emoji: "😔",
    title: "Mua khóa tập nhưng bỏ",
    description:
      "Bạn đã từng mua khóa tập online, xem được vài video đầu tiên, rồi quên luôn. Tiền mất, kết quả không có, và bạn tự trách mình thiếu kỷ luật.",
  },
  {
    emoji: "😓",
    title: "Tập 1-2 tuần rồi dừng",
    description:
      "Tuần đầu rất quyết tâm. Tuần hai bắt đầu mệt. Tuần ba có việc bận. Rồi dừng hẳn. Chu kỳ này cứ lặp đi lặp lại mãi.",
  },
  {
    emoji: "😢",
    title: "Bị cảm xúc chi phối",
    description:
      "Hôm nào có động lực thì tập. Hôm nào không có thì nghỉ. Kết quả là không bao giờ đi đến đâu, vì cảm xúc thì lên xuống theo ngày.",
  },
];

export function Problems() {
  return (
    <section className="py-12 md:py-20 lg:py-24 bg-neutral-50">
      <div className="container mx-auto px-4 sm:px-6">
        <SectionHeading title="Nghe quen không?" />
        <div className="mt-8 sm:mt-12 grid gap-6 sm:gap-8 sm:grid-cols-2 md:grid-cols-3">
          {problems.map((problem) => (
            <div
              key={problem.title}
              className="rounded-xl bg-white p-4 sm:p-6 border border-neutral-200 shadow-sm"
            >
              <span className="text-4xl">{problem.emoji}</span>
              <h3 className="mt-4 font-heading text-lg font-semibold text-primary">
                {problem.title}
              </h3>
              <p className="mt-3 text-neutral-600 leading-relaxed">
                {problem.description}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-8 sm:mt-12 max-w-[600px] mx-auto text-center text-neutral-600 text-sm sm:text-base leading-relaxed px-2">
          Nếu bạn thấy mình trong những tình huống trên, vấn đề không phải ở bạn.
          Vấn đề là bạn chưa có một hệ thống phù hợp. BodiX được thiết kế để giải
          quyết đúng những vấn đề này.
        </p>
      </div>
    </section>
  );
}
