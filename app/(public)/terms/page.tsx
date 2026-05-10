import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = {
  title: "Điều khoản sử dụng BodiX",
  description: "Điều khoản sử dụng nền tảng BodiX, quyền và nghĩa vụ người dùng.",
};

export default function TermsPage() {
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
        Điều khoản sử dụng BodiX
      </h1>
      <p className="mt-2 text-sm text-gray-500">Cập nhật: tháng 5/2026</p>

      <p className="mt-6 text-gray-700 leading-relaxed">
        Bằng việc tạo tài khoản và sử dụng dịch vụ BodiX (sau đây gọi là “Dịch
        vụ”), bạn đồng ý với các điều khoản dưới đây. Vui lòng đọc kỹ trước
        khi đăng ký.
      </p>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Định nghĩa</h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed">
          <li>
            <span className="font-medium">BodiX</span> – nền tảng tập luyện
            online vận hành tại bodix.fit, được sở hữu và phát triển bởi đội
            ngũ BodiX.
          </li>
          <li>
            <span className="font-medium">Người dùng</span> – cá nhân tạo tài
            khoản và sử dụng Dịch vụ.
          </li>
          <li>
            <span className="font-medium">Chương trình</span> – các lộ trình
            BodiX 21, BodiX 6W, BodiX 12W và các chương trình tương lai.
          </li>
          <li>
            <span className="font-medium">Nội dung</span> – video bài tập, ảnh,
            hướng dẫn, tài liệu, văn bản trên Dịch vụ.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          2. Phạm vi dịch vụ
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          BodiX cung cấp các dịch vụ sau cho Người dùng đã đăng ký:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed">
          <li>Truy cập video bài tập theo lộ trình của chương trình đã mua.</li>
          <li>Tin nhắc tập, tin rescue, tin tổng kết qua Zalo OA chính thức.</li>
          <li>
            Cộng đồng người tập cùng đợt (cohort), tính năng buddy, bảng xếp
            hạng chuỗi ngày.
          </li>
          <li>
            Theo dõi tiến trình cá nhân: chuỗi ngày, milestone, body scan, ảnh
            so sánh.
          </li>
          <li>Hỗ trợ qua email và Zalo OA trong giờ hành chính.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Tài khoản</h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed">
          <li>
            Mỗi cá nhân chỉ được tạo một tài khoản. Tài khoản gắn với một địa
            chỉ email và một số điện thoại đã xác minh.
          </li>
          <li>
            Bạn có trách nhiệm bảo mật mật khẩu và session đăng nhập. Mọi hoạt
            động dưới tài khoản của bạn được xem là do chính bạn thực hiện.
          </li>
          <li>
            Không được chia sẻ tài khoản, mật khẩu, hoặc đăng nhập tài khoản
            cho người khác sử dụng song song. Nếu phát hiện chia sẻ, BodiX có
            quyền khóa tài khoản và không hoàn tiền.
          </li>
          <li>
            Bạn có thể yêu cầu xóa tài khoản qua email{" "}
            <a
              href="mailto:support@bodix.fit"
              className="text-primary hover:underline"
            >
              support@bodix.fit
            </a>
            . BodiX xóa dữ liệu trong vòng 7 ngày làm việc.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          4. Nội dung và bản quyền
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed">
          <li>
            Toàn bộ video bài tập, hướng dẫn, tài liệu, hình ảnh, âm thanh
            trên BodiX thuộc sở hữu trí tuệ của BodiX hoặc đối tác đã cấp
            quyền cho BodiX.
          </li>
          <li>
            Bạn được cấp quyền sử dụng Nội dung cho mục đích tập luyện cá nhân
            trong thời gian có enrollment hợp lệ. Quyền này không thể chuyển
            nhượng.
          </li>
          <li>
            <span className="font-medium">NGHIÊM CẤM</span> sao chép, tải xuống,
            chỉnh sửa, đăng tải lại, phát trực tiếp, hoặc phát tán Nội dung
            trên bất kỳ nền tảng nào (YouTube, TikTok, Facebook, Telegram,
            Drive, USB…).
          </li>
          <li>
            <span className="font-medium">NGHIÊM CẤM</span> chia sẻ link video
            riêng tư cho người không đăng ký dịch vụ. Mọi link đều có
            watermark và log truy cập.
          </li>
          <li>
            Vi phạm bản quyền có thể dẫn đến khóa tài khoản vĩnh viễn, không
            hoàn tiền, và bị xử lý theo pháp luật hiện hành về sở hữu trí tuệ.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          5. Hành vi của Người dùng
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">Bạn cam kết không:</p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed">
          <li>Sử dụng Dịch vụ cho mục đích phi pháp hoặc gây hại.</li>
          <li>
            Quấy rối, đe dọa, xúc phạm Người dùng khác trong cộng đồng cohort
            hoặc các kênh hỗ trợ.
          </li>
          <li>
            Đăng tải nội dung vi phạm thuần phong mỹ tục, phân biệt đối xử,
            quảng cáo trái phép, hoặc spam trong cộng đồng.
          </li>
          <li>
            Cố ý phá hoại hệ thống, dò mật khẩu, khai thác lỗ hổng bảo mật,
            scrape dữ liệu, hoặc gian lận chương trình giới thiệu.
          </li>
          <li>
            Mạo danh BodiX, đại diện chính thức của BodiX, hoặc Người dùng
            khác.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Thanh toán</h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed">
          <li>
            Phí chương trình thanh toán một lần trước khi bắt đầu, không có
            subscription hoặc phí ẩn.
          </li>
          <li>
            Giá hiển thị bằng VNĐ và đã bao gồm các loại thuế áp dụng (nếu
            có).
          </li>
          <li>
            Hỗ trợ thanh toán qua các cổng thanh toán bên thứ 3 với thẻ ATM
            nội địa, Visa/Mastercard, QR ngân hàng, hoặc thẻ quốc tế.
          </li>
          <li>
            Hóa đơn điện tử được gửi tự động qua email sau khi giao dịch thành
            công.
          </li>
          <li>
            Mã giới thiệu (referral code) được áp dụng tại bước checkout. Một
            đơn hàng chỉ áp dụng được một mã.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          7. Chính sách hoàn tiền
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed">
          <li>
            <span className="font-medium">Trải nghiệm 3 ngày trước khi mua:
            </span>{" "}
            BodiX khuyến khích bạn dùng trial miễn phí để đánh giá trước khi
            thanh toán.
          </li>
          <li>
            <span className="font-medium">Trong 7 ngày đầu sau thanh toán:
            </span>{" "}
            nếu bạn chưa đăng nhập sau khi mua hoặc gặp vấn đề kỹ thuật khiến
            không sử dụng được Dịch vụ, gửi email yêu cầu hoàn tiền 100% kèm
            mã đơn hàng. BodiX xem xét và phản hồi trong 5 ngày làm việc.
          </li>
          <li>
            <span className="font-medium">Sau khi đã bắt đầu chương trình
            </span>{" "}
            (có ít nhất một lần check-in), không hoàn tiền cho phần đã sử
            dụng. Trường hợp đặc biệt (bệnh nặng có giấy xác nhận, mất khả
            năng lao động, sự kiện bất khả kháng) được xét riêng.
          </li>
          <li>
            BodiX không hoàn tiền cho việc bạn không hoàn thành chương trình
            do lý do cá nhân (bận, nản, đổi ý). Đây là lý do BodiX có rescue
            và buddy – để giúp bạn đi đến cuối.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          8. Tạm nghỉ và chuyển đợt
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed">
          <li>
            Bạn có thể tạm nghỉ tối đa 14 ngày liên tục mỗi chương trình. Khi
            resume, lịch tự dịch chuyển theo số ngày đã nghỉ.
          </li>
          <li>
            Bỏ tập 7 ngày liên tiếp mà chưa chủ động tạm nghỉ, hệ thống tự
            chuyển sang trạng thái paused.
          </li>
          <li>
            Bạn được chuyển đợt (cohort) một lần miễn phí trong tuần đầu của
            chương trình. Lần chuyển sau có thể tính phí điều phối.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          9. Sức khỏe và miễn trách
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed">
          <li>
            BodiX không phải dịch vụ y tế và không thay thế tư vấn của bác sĩ
            hoặc chuyên gia y tế.
          </li>
          <li>
            Nếu bạn có bệnh lý nền (tim mạch, huyết áp, xương khớp, mang thai,
            hậu phẫu thuật…), tham vấn bác sĩ trước khi bắt đầu bất kỳ chương
            trình nào.
          </li>
          <li>
            Trong quá trình tập, nếu cảm thấy đau bất thường, chóng mặt, khó
            thở – dừng ngay và nghỉ ngơi. Liên hệ y tế nếu triệu chứng kéo
            dài.
          </li>
          <li>
            BodiX không chịu trách nhiệm cho chấn thương, vấn đề sức khỏe, hoặc
            thiệt hại phát sinh do tập sai kỹ thuật, cố sức quá mức, hoặc tập
            khi không phù hợp tình trạng sức khỏe.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          10. Giới hạn trách nhiệm
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Trong phạm vi pháp luật cho phép, BodiX không chịu trách nhiệm cho
          các thiệt hại gián tiếp, ngẫu nhiên, hoặc hậu quả phát sinh từ việc
          sử dụng Dịch vụ, bao gồm nhưng không giới hạn:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed">
          <li>Mất dữ liệu do lỗi thiết bị cá nhân hoặc kết nối Internet.</li>
          <li>Gián đoạn dịch vụ do nhà cung cấp hạ tầng bên thứ 3.</li>
          <li>
            Sự cố từ các nhà cung cấp dịch vụ bên thứ 3 mà BodiX phụ thuộc
            (cổng thanh toán, kênh nhắn tin, hosting video, v.v.).
          </li>
        </ul>
        <p className="text-gray-700 leading-relaxed mt-4">
          Tổng trách nhiệm của BodiX cho mỗi Người dùng không vượt quá số
          tiền bạn đã thanh toán cho chương trình hiện tại.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          11. Chấm dứt dịch vụ
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          BodiX có quyền tạm khóa hoặc chấm dứt tài khoản trong các trường
          hợp:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed">
          <li>Vi phạm bất kỳ điều khoản nào trong văn bản này.</li>
          <li>Phát tán Nội dung của BodiX ra ngoài.</li>
          <li>Gian lận trong chương trình giới thiệu hoặc affiliate.</li>
          <li>Có dấu hiệu lừa đảo, mạo danh, hoặc gây hại cho Người dùng khác.</li>
        </ul>
        <p className="text-gray-700 leading-relaxed mt-4">
          Trường hợp khóa do vi phạm, BodiX không hoàn tiền cho phần thời
          gian còn lại của chương trình.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          12. Thay đổi điều khoản
        </h2>
        <p className="text-gray-700 leading-relaxed">
          BodiX có quyền cập nhật điều khoản này khi có thay đổi về pháp luật
          hoặc dịch vụ. Bản cập nhật được công bố tại trang này và thông báo
          qua email cho Người dùng đang active. Việc tiếp tục sử dụng Dịch vụ
          sau ngày cập nhật được xem là bạn chấp nhận điều khoản mới.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          13. Pháp luật áp dụng
        </h2>
        <p className="text-gray-700 leading-relaxed">
          Điều khoản này được điều chỉnh bởi pháp luật Việt Nam. Mọi tranh
          chấp được ưu tiên giải quyết qua thương lượng. Trường hợp không
          thương lượng được, tranh chấp được giải quyết tại tòa án có thẩm
          quyền nơi BodiX đặt trụ sở.
        </p>
      </section>

      <section className="mt-10 mb-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">14. Liên hệ</h2>
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
          <li>Zalo OA: BodiX</li>
          <li>
            Facebook:{" "}
            <a
              href="https://www.facebook.com/bodixfit"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              facebook.com/bodixfit
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
