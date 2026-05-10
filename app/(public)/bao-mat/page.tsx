export const metadata = {
  title: "Chính sách bảo mật BodiX",
  description: "Chính sách bảo mật và xử lý dữ liệu cá nhân của BodiX.",
};

export default function BaoMatPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-6">Chính sách bảo mật</h1>

      <section className="prose prose-gray max-w-none">
        <p className="text-sm text-gray-500">Cập nhật: tháng 5/2026</p>

        <h2>1. Thông tin BodiX thu thập</h2>
        <ul>
          <li>Email, tên, ngày sinh, giới tính – để tạo tài khoản</li>
          <li>Số điện thoại, Zalo ID – để gửi tin nhắc tập</li>
          <li>
            Dữ liệu tập luyện (check-in, chuỗi ngày, completion) – để theo dõi
            tiến trình
          </li>
          <li>Ảnh tiến trình (nếu bạn upload) – để bạn so sánh trước/sau</li>
        </ul>

        <h2>2. Mục đích sử dụng</h2>
        <ul>
          <li>Cung cấp dịch vụ tập luyện</li>
          <li>Gửi tin nhắc tập, thông báo đợt tập mới</li>
          <li>Cải thiện sản phẩm và trải nghiệm người dùng</li>
        </ul>

        <h2>3. Chia sẻ dữ liệu</h2>
        <ul>
          <li>
            BodiX KHÔNG bán hoặc chia sẻ dữ liệu cá nhân với bên thứ 3 cho mục
            đích thương mại.
          </li>
          <li>Dữ liệu lưu trên Supabase (hosting an toàn, có mã hóa).</li>
          <li>Tin nhắn Zalo gửi qua Zalo OA chính thức của BodiX.</li>
          <li>Push notification gửi qua Firebase Cloud Messaging (cho app).</li>
        </ul>

        <h2>4. Bảo mật</h2>
        <ul>
          <li>Mật khẩu mã hóa, không lưu dạng plaintext.</li>
          <li>Dữ liệu cá nhân được bảo vệ bằng Row Level Security (RLS).</li>
          <li>Chỉ bạn xem được dữ liệu của mình.</li>
        </ul>

        <h2>5. Xóa dữ liệu</h2>
        <p>
          Để xóa toàn bộ dữ liệu cá nhân khỏi BodiX, gửi email yêu cầu đến
          support@bodix.fit. Chúng tôi xóa trong vòng 7 ngày làm việc.
        </p>

        <h2>6. Cookie</h2>
        <p>
          BodiX dùng cookie kỹ thuật cần thiết (đăng nhập, session). Không dùng
          cookie quảng cáo bên thứ 3.
        </p>

        <h2>7. Liên hệ</h2>
        <p>Email: support@bodix.fit</p>
      </section>
    </div>
  );
}
