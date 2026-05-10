export const metadata = {
  title: "Điều khoản sử dụng BodiX",
  description: "Điều khoản sử dụng nền tảng BodiX.",
};

export default function DieuKhoanPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-6">Điều khoản sử dụng BodiX</h1>

      <section className="prose prose-gray max-w-none">
        <p className="text-sm text-gray-500">Cập nhật: tháng 5/2026</p>

        <h2>1. Dịch vụ</h2>
        <p>
          BodiX cung cấp chương trình tập luyện online cho phụ nữ, với lộ trình
          3-12 tuần. Dịch vụ bao gồm video bài tập, tin nhắc tập qua Zalo, cộng
          đồng người tập cùng đợt.
        </p>

        <h2>2. Tài khoản</h2>
        <ul>
          <li>Mỗi người 1 tài khoản. Không chia sẻ tài khoản với người khác.</li>
          <li>Bạn chịu trách nhiệm bảo mật mật khẩu.</li>
          <li>BodiX có quyền khóa tài khoản vi phạm điều khoản.</li>
        </ul>

        <h2>3. Nội dung và bản quyền</h2>
        <ul>
          <li>
            Toàn bộ video bài tập, hướng dẫn, tài liệu thuộc bản quyền BodiX.
          </li>
          <li>
            NGHIÊM CẤM sao chép, tải xuống, phát tán, đăng tải lại video bài
            tập trên bất kỳ nền tảng nào.
          </li>
          <li>
            NGHIÊM CẤM chia sẻ link video Vimeo riêng tư cho người không đăng
            ký.
          </li>
          <li>Vi phạm có thể dẫn đến khóa tài khoản và xử lý pháp lý.</li>
        </ul>

        <h2>4. Thanh toán</h2>
        <ul>
          <li>Phí chương trình thanh toán 1 lần trước khi bắt đầu.</li>
          <li>Không hoàn tiền sau khi đã bắt đầu chương trình.</li>
          <li>
            Trong 7 ngày đầu, nếu bạn không đăng nhập lần nào và yêu cầu hoàn
            tiền, BodiX sẽ xem xét trường hợp.
          </li>
        </ul>

        <h2>5. Sức khỏe và miễn trách</h2>
        <ul>
          <li>
            BodiX không phải dịch vụ y tế. Tham vấn bác sĩ trước khi bắt đầu
            nếu bạn có bệnh nền.
          </li>
          <li>
            BodiX không chịu trách nhiệm cho chấn thương xảy ra do tập sai kỹ
            thuật hoặc không phù hợp tình trạng sức khỏe.
          </li>
        </ul>

        <h2>6. Liên hệ</h2>
        <p>Email: support@bodix.fit | Zalo OA: BodiX</p>
      </section>
    </div>
  );
}
