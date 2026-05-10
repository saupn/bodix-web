export const metadata = {
  title: "Hướng dẫn sử dụng BodiX",
  description: "Hướng dẫn đăng ký, tập luyện, và sử dụng BodiX hàng ngày.",
};

export default function HuongDanPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-6">Hướng dẫn sử dụng BodiX</h1>

      <section className="prose prose-gray max-w-none">
        <h2>1. Đăng ký và bắt đầu</h2>
        <ol>
          <li>Tạo tài khoản tại bodix.fit/signup</li>
          <li>Hoàn thành onboarding (5 bước)</li>
          <li>Xác minh số điện thoại Zalo để nhận tin nhắc tập</li>
          <li>Đăng ký tập thử 3 ngày miễn phí</li>
        </ol>

        <h2>2. Tập luyện hàng ngày</h2>
        <ol>
          <li>Sáng 6:30 nhận tin nhắc tập qua Zalo</li>
          <li>Bấm link xem video bài tập</li>
          <li>Tập theo video, chọn cường độ phù hợp (3/2/1 lượt)</li>
          <li>Sau khi tập xong, reply số đã hoàn thành về Zalo (3, 2, hoặc 1)</li>
        </ol>

        <h2>3. Khi mệt hoặc bận</h2>
        <p>BodiX có hệ thống &quot;rescue&quot; hỗ trợ:</p>
        <ul>
          <li>Mệt: chọn cường độ thấp hơn (1 lượt – 7-10 phút)</li>
          <li>Bận: tập tối thiểu 1 lượt để giữ chuỗi</li>
          <li>
            Bỏ 2 ngày: BodiX tự động gửi tin nhắn động viên + buddy được thông
            báo
          </li>
        </ul>

        <h2>4. Tổng kết tuần</h2>
        <p>
          Cuối mỗi tuần, BodiX gửi video tổng kết và form đánh giá. Trả lời thật
          để hệ thống điều chỉnh phù hợp với bạn.
        </p>

        <h2>5. Hỗ trợ</h2>
        <p>
          Nhắn tin về Zalo OA BodiX hoặc email support@bodix.fit. Phản hồi trong
          24 giờ.
        </p>
      </section>
    </div>
  );
}
