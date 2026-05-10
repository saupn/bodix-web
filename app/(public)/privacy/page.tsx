import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = {
  title: "Chính sách bảo mật BodiX",
  description:
    "Chính sách bảo mật và xử lý dữ liệu cá nhân của BodiX. Bạn kiểm soát dữ liệu của mình.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 md:py-14 px-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4" />
        Quay lại trang chủ
      </Link>

      <h1 className="mt-6 text-3xl md:text-4xl font-bold text-gray-900">
        Chính sách bảo mật
      </h1>
      <p className="mt-2 text-sm text-gray-500">Cập nhật: tháng 5/2026</p>

      <p className="mt-6 text-gray-700 leading-relaxed">
        Tại BodiX, chúng tôi tin rằng dữ liệu của bạn là của bạn. Chính sách
        này mô tả thông tin BodiX thu thập, lý do thu thập, cách lưu trữ, chia
        sẻ, và quyền của bạn đối với dữ liệu cá nhân.
      </p>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          1. Thông tin BodiX thu thập
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          <span className="font-medium">Thông tin tài khoản (bắt buộc):</span>
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed mb-4">
          <li>Email và mật khẩu (mã hóa một chiều, không lưu dạng đọc được).</li>
          <li>Họ tên hiển thị.</li>
          <li>Ngày sinh và giới tính – để điều chỉnh khuyến nghị cường độ.</li>
          <li>
            Số điện thoại Việt Nam và Zalo ID – để gửi tin nhắc tập, rescue,
            tổng kết tuần.
          </li>
        </ul>
        <p className="text-gray-700 leading-relaxed mb-4">
          <span className="font-medium">Dữ liệu sử dụng (tự động sinh ra
          khi bạn dùng dịch vụ):</span>
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed mb-4">
          <li>Check-in hàng ngày: ngày, cường độ chọn, cảm giác (1–5).</li>
          <li>Chuỗi ngày hiện tại, chuỗi dài nhất, milestone đạt được.</li>
          <li>Tổng kết tuần, body scan, mid-program reflection.</li>
          <li>Lịch sử thanh toán và enrollment.</li>
          <li>
            Thông tin thiết bị và trình duyệt (User-Agent), địa chỉ IP, ngôn
            ngữ – để vận hành và bảo mật.
          </li>
        </ul>
        <p className="text-gray-700 leading-relaxed mb-4">
          <span className="font-medium">Tùy chọn (chỉ khi bạn cung cấp):
          </span>
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed">
          <li>
            Ảnh tiến trình (before / midpoint / after) – để bạn so sánh thay
            đổi.
          </li>
          <li>Bài đăng và phản ứng trong cộng đồng cohort.</li>
          <li>
            Thông tin ngân hàng (chỉ với affiliate) – tên ngân hàng, số tài
            khoản, chủ tài khoản, chi nhánh – để chuyển hoa hồng.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          2. Mục đích sử dụng dữ liệu
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          BodiX sử dụng dữ liệu của bạn cho các mục đích sau:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed">
          <li>
            <span className="font-medium">Cung cấp dịch vụ tập luyện:</span>{" "}
            xác thực đăng nhập, hiển thị bài tập, ghi nhận check-in, tính
            chuỗi ngày.
          </li>
          <li>
            <span className="font-medium">Liên lạc qua Zalo và email:</span>
            {" "}tin nhắc tập, rescue, tổng kết tuần, thông báo đợt mới, hóa
            đơn.
          </li>
          <li>
            <span className="font-medium">Cá nhân hóa:</span> điều chỉnh
            khuyến nghị cường độ dựa trên feedback weekly review của bạn.
          </li>
          <li>
            <span className="font-medium">Thống kê và cải thiện:</span> dữ
            liệu được tổng hợp ở mức ẩn danh để hiểu mức độ hoàn thành chương
            trình, từ đó cải thiện sản phẩm.
          </li>
          <li>
            <span className="font-medium">An ninh và phòng chống gian lận:
            </span>{" "}
            phát hiện đăng nhập bất thường, rate-limit, anti-fraud cho chương
            trình affiliate.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          3. Cơ sở pháp lý
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          BodiX xử lý dữ liệu của bạn dựa trên:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed">
          <li>
            <span className="font-medium">Hợp đồng dịch vụ:</span> dữ liệu cần
            thiết để BodiX thực hiện dịch vụ bạn đã đăng ký.
          </li>
          <li>
            <span className="font-medium">Sự đồng ý của bạn:</span> với những
            mục tùy chọn (ảnh tiến trình, bài đăng cộng đồng, thông tin ngân
            hàng).
          </li>
          <li>
            <span className="font-medium">Lợi ích hợp pháp:</span> bảo mật, an
            ninh hệ thống, ngăn gian lận, cải thiện sản phẩm.
          </li>
          <li>
            <span className="font-medium">Tuân thủ pháp luật:</span> khi cơ
            quan có thẩm quyền yêu cầu trong phạm vi luật định.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          4. Chia sẻ dữ liệu
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          <span className="font-medium">BodiX KHÔNG bán dữ liệu cá nhân cho
          bên thứ 3</span> cho mục đích quảng cáo hoặc thương mại.
        </p>
        <p className="text-gray-700 leading-relaxed mb-4">
          Chúng tôi chỉ chia sẻ dữ liệu với các nhà cung cấp dịch vụ bên thứ
          3 đã được BodiX đánh giá và ký thỏa thuận xử lý dữ liệu, phục vụ
          các mục đích vận hành sau:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed mb-4">
          <li>Hạ tầng lưu trữ, hosting, và xác thực tài khoản.</li>
          <li>Gửi tin nhắc tập, rescue, và tổng kết qua kênh Zalo.</li>
          <li>Xử lý thanh toán qua các cổng thanh toán bên thứ 3 – BodiX không lưu thông tin thẻ của bạn.</li>
          <li>Gửi email giao dịch (xác minh tài khoản, hóa đơn, tổng kết).</li>
          <li>Hosting video bài tập riêng tư, có watermark.</li>
          <li>Ghi nhận lỗi kỹ thuật để cải thiện sản phẩm (đã ẩn dữ liệu cá nhân).</li>
          <li>Push notification cho ứng dụng di động (sắp ra mắt).</li>
        </ul>
        <p className="text-gray-700 leading-relaxed">
          Một số nhà cung cấp có máy chủ ngoài Việt Nam. Việc chuyển dữ liệu
          ra ngoài lãnh thổ tuân thủ pháp luật bảo vệ dữ liệu cá nhân hiện
          hành.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          5. Bảo mật dữ liệu
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed">
          <li>
            Mật khẩu được mã hóa một chiều; nhân viên BodiX không thể xem
            mật khẩu của bạn.
          </li>
          <li>
            Toàn bộ traffic mã hóa TLS 1.2+. Cookie session đặt HttpOnly,
            Secure, SameSite.
          </li>
          <li>
            Mọi bảng dữ liệu áp dụng kiểm soát truy cập theo hàng – Người
            dùng chỉ truy cập được dữ liệu của chính mình.
          </li>
          <li>
            Truy cập hạ tầng nội bộ chỉ dành cho thành viên đã xác thực 2
            yếu tố. Mọi thao tác admin được log lại.
          </li>
          <li>
            Backup dữ liệu hàng tuần, lưu giữ tối thiểu 4 phiên bản gần nhất.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          6. Thời gian lưu trữ
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed">
          <li>
            Dữ liệu tài khoản và lịch sử tập luyện: lưu trong suốt thời gian
            tài khoản hoạt động.
          </li>
          <li>
            Dữ liệu thanh toán và hóa đơn: lưu tối thiểu 5 năm theo quy định
            kế toán.
          </li>
          <li>
            Log hệ thống và log lỗi kỹ thuật: lưu tối đa 90 ngày, sau đó xóa
            tự động.
          </li>
          <li>
            Sau khi tài khoản bị xóa: dữ liệu cá nhân được xóa trong 7 ngày
            làm việc; backup chứa dữ liệu cũ tự động hết hạn trong vòng 30
            ngày.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          7. Quyền của Người dùng
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Bạn có các quyền sau với dữ liệu cá nhân của mình:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed">
          <li>
            <span className="font-medium">Truy cập:</span> xem toàn bộ dữ liệu
            BodiX đang lưu về bạn (Hồ sơ → Dữ liệu của tôi).
          </li>
          <li>
            <span className="font-medium">Chỉnh sửa:</span> cập nhật thông tin
            cá nhân, số điện thoại, email, mục tiêu tập luyện.
          </li>
          <li>
            <span className="font-medium">Xuất dữ liệu:</span> yêu cầu file
            JSON chứa toàn bộ dữ liệu của bạn qua email{" "}
            <a
              href="mailto:support@bodix.fit"
              className="text-primary hover:underline"
            >
              support@bodix.fit
            </a>
            .
          </li>
          <li>
            <span className="font-medium">Xóa:</span> yêu cầu xóa toàn bộ tài
            khoản và dữ liệu liên quan.
          </li>
          <li>
            <span className="font-medium">Rút sự đồng ý:</span> tắt một loại
            thông báo Zalo, gỡ ảnh đã upload, ẩn bài đăng.
          </li>
          <li>
            <span className="font-medium">Khiếu nại:</span> nếu bạn cho rằng
            dữ liệu bị xử lý sai, gửi yêu cầu để BodiX xem xét.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          8. Cookie và công nghệ tương tự
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          BodiX chỉ dùng cookie kỹ thuật cần thiết:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed mb-4">
          <li>Session đăng nhập.</li>
          <li>Tùy chọn ngôn ngữ và giao diện.</li>
          <li>
            Anti-CSRF token để bảo vệ form submit.
          </li>
        </ul>
        <p className="text-gray-700 leading-relaxed">
          BodiX <span className="font-medium">không dùng cookie quảng cáo bên
          thứ 3</span>, không dùng các công cụ tracker để theo dõi bạn xuyên
          website.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          9. Trẻ em dưới 16 tuổi
        </h2>
        <p className="text-gray-700 leading-relaxed">
          BodiX dành cho người trưởng thành, đặc biệt phụ nữ 25–45 tuổi.
          Chúng tôi không thu thập có chủ đích dữ liệu của trẻ em dưới 16
          tuổi. Nếu bạn là phụ huynh phát hiện con mình đã đăng ký, vui lòng
          liên hệ để BodiX xóa tài khoản.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          10. Cập nhật chính sách
        </h2>
        <p className="text-gray-700 leading-relaxed">
          Khi có thay đổi quan trọng, BodiX cập nhật trang này và gửi thông
          báo qua email. Phiên bản hiện tại được ghi rõ ngày ở đầu trang.
          Việc tiếp tục sử dụng Dịch vụ sau ngày cập nhật được xem là bạn
          chấp nhận chính sách mới.
        </p>
      </section>

      <section className="mt-10 mb-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          11. Liên hệ về quyền riêng tư
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Cần xóa dữ liệu, xuất dữ liệu, hoặc khiếu nại liên quan đến quyền
          riêng tư:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed">
          <li>
            Email:{" "}
            <a
              href="mailto:support@bodix.fit"
              className="text-primary hover:underline"
            >
              support@bodix.fit
            </a>
          </li>
          <li>
            Tiêu đề email: <span className="font-medium">[Privacy] Yêu cầu
            của bạn</span>.
          </li>
        </ul>
      </section>
    </div>
  );
}
