export default function ForEveryWoman() {
  return (
    <section className="py-12 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 text-center">
          Bài tập điều chỉnh được – cho mọi lứa tuổi và thể trạng
        </h2>
        <p className="text-gray-700 text-center mb-8 max-w-2xl mx-auto">
          BodiX không yêu cầu bạn phải nhảy cao hay tập theo nhịp nhanh. Mỗi
          động tác có 3 cách thực hiện – bạn chọn theo cơ thể mình.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
            <div className="text-3xl mb-3">🐢</div>
            <h3 className="font-semibold mb-2">Nhẹ nhàng</h3>
            <p className="text-sm text-gray-700">
              Bài jumping → đứng lên ngồi xuống. Cardio nhẹ, không tác động
              khớp gối.
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
            <div className="text-3xl mb-3">🚶‍♀️</div>
            <h3 className="font-semibold mb-2">Vừa phải</h3>
            <p className="text-sm text-gray-700">
              Theo đúng nhịp video. Phù hợp người trung niên, đã quen vận
              động.
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
            <div className="text-3xl mb-3">💪</div>
            <h3 className="font-semibold mb-2">Tăng cường</h3>
            <p className="text-sm text-gray-700">
              Cầm thêm tạ tay, chai nước. Phù hợp người trẻ, muốn cường độ cao
              hơn.
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-600 text-center mt-6 max-w-2xl mx-auto">
          Tất cả bài tập đã được nghiên cứu kỹ về kỹ thuật và độ an toàn –
          không phải bài fitness ngẫu nhiên trên TikTok.
        </p>
      </div>
    </section>
  );
}
