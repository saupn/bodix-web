const BENEFITS = [
  {
    emoji: "🌅",
    title: "Sáng dậy bớt mệt",
    body: "Tuần đầu, bạn nhận thấy giấc ngủ sâu hơn, sáng dậy ít uể oải.",
  },
  {
    emoji: "🚶‍♀️",
    title: "Đi lại nhẹ hơn",
    body: "Lên cầu thang không thở dốc. Bê đồ, đứng lâu cũng đỡ mỏi.",
  },
  {
    emoji: "👗",
    title: "Quần áo vừa hơn",
    body: "Vòng eo, đùi, bắp tay săn lại. Quần áo cũ mặc thoải mái hơn.",
  },
  {
    emoji: "😌",
    title: "Tâm trạng tốt hơn",
    body: "Vận động thường xuyên giúp giảm stress, cải thiện tâm trạng tự nhiên.",
  },
  {
    emoji: "🏃‍♀️",
    title: "Sức bền tăng dần",
    body: "Đi bộ xa hơn, làm việc nhà mà không hết hơi như trước.",
  },
  {
    emoji: "💪",
    title: "Tự tin trong cơ thể",
    body: "Khi bạn hoàn thành – cảm giác “tôi làm được” lan sang nhiều việc khác trong cuộc sống.",
  },
];

export default function HealthBenefits() {
  return (
    <section className="py-12 px-4 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 text-center">
          Tập đều mỗi ngày – bạn sẽ thấy
        </h2>
        <p className="text-gray-600 text-center mb-8">
          Không phải lời hứa lột xác. Đây là những thay đổi thật mà phụ nữ
          tập đều thường nhận thấy.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="bg-white rounded-xl p-5 border border-gray-200 flex gap-3"
            >
              <span className="text-2xl">{b.emoji}</span>
              <div>
                <h3 className="font-semibold mb-1">{b.title}</h3>
                <p className="text-sm text-gray-700">{b.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
