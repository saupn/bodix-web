import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = {
  title: "Hướng dẫn sử dụng BodiX",
  description:
    "Hướng dẫn đầy đủ cách đăng ký, tập luyện hàng ngày, dùng buddy và rescue, theo dõi tiến trình trên BodiX.",
};

export default function GuidePage() {
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
        Hướng dẫn sử dụng BodiX
      </h1>
      <p className="mt-2 text-base text-gray-600">
        Đọc một lần là biết cách dùng. Khoảng 5 phút.
      </p>

      <nav className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-5">
        <p className="text-sm font-semibold text-gray-900 mb-3">Mục lục</p>
        <ol className="list-decimal pl-5 space-y-1.5 text-sm text-gray-700">
          <li><a href="#dang-ky" className="hover:text-primary hover:underline">Đăng ký và onboarding</a></li>
          <li><a href="#trial" className="hover:text-primary hover:underline">Với 3 ngày trải nghiệm miễn phí</a></li>
          <li><a href="#chon-chuong-trinh" className="hover:text-primary hover:underline">Chọn chương trình và mua</a></li>
          <li><a href="#tap-hang-ngay" className="hover:text-primary hover:underline">Tập luyện hàng ngày</a></li>
          <li><a href="#cuong-do" className="hover:text-primary hover:underline">3 mức cường độ Hard / Light / Easy</a></li>
          <li><a href="#zalo" className="hover:text-primary hover:underline">Tin nhắc qua Zalo</a></li>
          <li><a href="#buddy" className="hover:text-primary hover:underline">Buddy – người tập cùng đợt</a></li>
          <li><a href="#rescue" className="hover:text-primary hover:underline">Khi mệt hoặc bận – Rescue</a></li>
          <li><a href="#tong-ket" className="hover:text-primary hover:underline">Tổng kết tuần và giữa chương trình</a></li>
          <li><a href="#tien-do" className="hover:text-primary hover:underline">Theo dõi tiến độ và chuỗi ngày</a></li>
          <li><a href="#hoan-thanh" className="hover:text-primary hover:underline">Hoàn thành chương trình</a></li>
          <li><a href="#ho-tro" className="hover:text-primary hover:underline">Hỗ trợ và liên hệ</a></li>
        </ol>
      </nav>

      <section id="dang-ky" className="mt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          1. Đăng ký và onboarding
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Truy cập <span className="font-medium">bodix.fit/signup</span> và tạo
          tài khoản bằng email hoặc đăng nhập Google. Sau khi xác minh email,
          bạn sẽ được dẫn vào quy trình onboarding 5 bước:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed mb-4">
          <li>
            <span className="font-medium">Họ và tên</span> – để BodiX gọi bạn
            trong các tin nhắn và bảng cộng đồng.
          </li>
          <li>
            <span className="font-medium">Ngày sinh và giới tính</span> – để
            điều chỉnh khuyến nghị cường độ phù hợp.
          </li>
          <li>
            <span className="font-medium">Mục tiêu tập luyện</span> – giảm cân,
            săn chắc, khỏe hơn, hay duy trì năng lượng. Bạn có thể chọn nhiều.
          </li>
          <li>
            <span className="font-medium">Số điện thoại Zalo</span> – để nhận
            tin nhắc tập, rescue khi mệt, và tổng kết tuần. Đây là kênh chính
            BodiX dùng để liên lạc với bạn.
          </li>
          <li>
            <span className="font-medium">Xác minh OTP qua SMS</span> – nhập 6
            số được gửi đến số điện thoại để hoàn tất.
          </li>
        </ul>
        <p className="text-gray-700 leading-relaxed">
          Sau onboarding, bạn vào dashboard với 3 ngày trải nghiệm miễn phí
          được kích hoạt sẵn.
        </p>
      </section>

      <section id="trial" className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          2. Với 3 ngày trải nghiệm miễn phí
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Trial cho phép bạn dùng đầy đủ tính năng trước khi quyết định mua.
          Trong 3 ngày bạn có thể:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed mb-4">
          <li>Xem 3 buổi tập đầu tiên của BodiX 21.</li>
          <li>Thử check-in và cảm nhận luồng hàng ngày.</li>
          <li>Đọc nội dung các chương trình BodiX 6W, 12W để chọn lộ trình.</li>
          <li>Nhận tin nhắc qua Zalo như người đã mua chính thức.</li>
        </ul>
        <p className="text-gray-700 leading-relaxed">
          Trial không tính phí, không cần thẻ tín dụng. Khi trial sắp hết
          (24 giờ và 6 giờ trước khi kết thúc), BodiX sẽ nhắc qua Zalo để bạn
          quyết định chọn chương trình.
        </p>
      </section>

      <section id="chon-chuong-trinh" className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          3. Chọn chương trình và mua
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          BodiX có 3 chương trình, đi từ ngắn đến dài:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed mb-4">
          <li>
            <span className="font-medium">BodiX 21</span> – 21 ngày, 499.000đ.
            Dành cho người mới hoặc đã thử nhiều chương trình mà chưa hoàn
            thành lần nào.
          </li>
          <li>
            <span className="font-medium">BodiX 6W</span> – 42 ngày, 1.199.000đ.
            Bắt đầu thấy thay đổi rõ rệt từ tuần thứ 3, có tổng kết chuyên sâu.
          </li>
          <li>
            <span className="font-medium">BodiX 12W</span> – 84 ngày, 1.999.000đ.
            Lộ trình đầy đủ nhất với nutrition protocol và reflection giữa
            chương trình.
          </li>
        </ul>
        <p className="text-gray-700 leading-relaxed mb-4">
          Bạn cần hoàn thành BodiX 21 trước khi mua được 6W, và hoàn thành 6W
          trước khi mua được 12W. Đây là cơ chế bảo vệ để bạn không nhảy cóc
          vào chương trình quá sức.
        </p>
        <p className="text-gray-700 leading-relaxed">
          Thanh toán qua VNPay (thẻ ATM nội địa, Visa/Mastercard, QR ngân
          hàng). Sau khi thanh toán thành công, enrollment chuyển sang trạng
          thái <span className="font-medium">active</span> và bạn được ghép
          vào đợt (cohort) gần nhất.
        </p>
      </section>

      <section id="tap-hang-ngay" className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          4. Tập luyện hàng ngày
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Mỗi tuần BodiX có cấu trúc cố định để cơ thể có nhịp:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed mb-4">
          <li>
            <span className="font-medium">Thứ 2 – Thứ 6:</span> 5 buổi tập
            chính, 7–25 phút tùy cường độ bạn chọn.
          </li>
          <li>
            <span className="font-medium">Thứ 7:</span> buổi phục hồi
            (stretching và thở) – 7–10 phút.
          </li>
          <li>
            <span className="font-medium">Chủ nhật:</span> Tổng kết tuần – xem
            video coach, đánh giá body scan, đặt mục tiêu tuần mới (~25 phút).
          </li>
        </ul>
        <p className="text-gray-700 leading-relaxed mb-4">Quy trình mỗi ngày:</p>
        <ol className="list-decimal pl-6 space-y-2 text-gray-700 leading-relaxed mb-4">
          <li>
            Sáng 6:30 (giờ Việt Nam) bạn nhận tin nhắc tập qua Zalo. Nội dung
            tin có tên buổi tập hôm nay và link mở app.
          </li>
          <li>
            Bấm link để vào trang bài tập. Bạn thấy video, mô tả cường độ,
            danh sách động tác.
          </li>
          <li>
            Chọn cường độ <span className="font-medium">Hard / Light / Easy</span>
            {" "}và bấm bắt đầu. Tập theo video, có thể tạm dừng nếu cần.
          </li>
          <li>
            Tập xong, bấm <span className="font-medium">Hoàn thành</span>{" "}
            (check-in). Hoặc reply số lượt đã làm về Zalo (3, 2, hoặc 1) –
            BodiX cũng ghi nhận.
          </li>
          <li>
            Đánh giá nhanh cảm giác (1–5 sao) – dữ liệu này dùng để cảnh báo
            sớm khi bạn quá tải hoặc giảm động lực.
          </li>
        </ol>
        <p className="text-gray-700 leading-relaxed">
          Bạn có thể tập sáng, trưa, tối – không bắt buộc theo giờ nhắc. Quan
          trọng là tập trong ngày.
        </p>
      </section>

      <section id="cuong-do" className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          5. 3 mức cường độ Hard / Light / Easy
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Mỗi buổi tập chính có 3 mức cường độ. Bạn chọn theo cảm giác cơ thể
          hôm đó, không cần cam kết trước:
        </p>
        <div className="grid gap-4 md:grid-cols-3 mb-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="font-bold text-gray-900 mb-1">💪 Hard</p>
            <p className="text-sm text-gray-700 leading-relaxed">
              3 lượt, 21–25 phút. Cho ngày bạn tràn năng lượng, ngủ đủ, ăn ổn.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="font-bold text-gray-900 mb-1">🌿 Light</p>
            <p className="text-sm text-gray-700 leading-relaxed">
              2 lượt, 14–18 phút. Cho ngày bình thường, không quá mệt cũng
              không quá khỏe.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="font-bold text-gray-900 mb-1">☀️ Easy</p>
            <p className="text-sm text-gray-700 leading-relaxed">
              1 lượt, 7–10 phút. Cho ngày mệt, bận, hoặc đang ốm nhẹ. Giữ
              nhịp là đủ.
            </p>
          </div>
        </div>
        <p className="text-gray-700 leading-relaxed">
          Triết lý của BodiX: chọn Easy còn hơn bỏ. Một ngày 7 phút giữ chuỗi
          tốt hơn 0 phút làm đứt chuỗi.
        </p>
      </section>

      <section id="zalo" className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          6. Tin nhắc qua Zalo
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Zalo là kênh chính BodiX dùng để giữ bạn ở lại với chương trình. Có
          4 loại tin nhắn bạn sẽ nhận:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed mb-4">
          <li>
            <span className="font-medium">Tin nhắc sáng (6:30):</span> báo bài
            tập hôm nay.
          </li>
          <li>
            <span className="font-medium">Tin xác nhận tối (21:00):</span> nếu
            bạn chưa check-in trong ngày, BodiX hỏi bạn còn tập không.
          </li>
          <li>
            <span className="font-medium">Tin rescue:</span> khi bạn bỏ 1–3
            ngày liên tiếp, BodiX gửi tin nhắc mềm để kéo bạn quay lại.
          </li>
          <li>
            <span className="font-medium">Tin tổng kết tuần (Chủ nhật):</span>{" "}
            link tới video tổng kết và form đánh giá.
          </li>
        </ul>
        <p className="text-gray-700 leading-relaxed mb-4">
          Bạn có thể tùy chỉnh giờ nhắc và bật/tắt từng loại tin trong{" "}
          <span className="font-medium">Hồ sơ → Thông báo</span>. Nếu muốn tập
          trung tuyệt đối, bạn có thể tạm tắt tất cả nhưng BodiX khuyên giữ
          ít nhất tin sáng.
        </p>
      </section>

      <section id="buddy" className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          7. Buddy – người tập cùng đợt
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Buddy là một người khác trong cùng đợt (cohort) với bạn. Cả hai cùng
          xem tiến độ của nhau và có thể nhắc nhau khi cần.
        </p>
        <p className="text-gray-700 leading-relaxed mb-4">
          Quan trọng: <span className="font-medium">Buddy không phải coach,
          không phải PT cá nhân</span>. Đây là người tập song song với bạn,
          để cả hai cùng có động lực.
        </p>
        <p className="text-gray-700 leading-relaxed mb-4">Buddy hoạt động:</p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed mb-4">
          <li>
            Khi vào cohort, bạn tự chọn một người làm buddy hoặc để hệ thống
            ghép ngẫu nhiên.
          </li>
          <li>
            Trên dashboard có thẻ Buddy hiện tên, trạng thái tập hôm nay, và
            chuỗi ngày của buddy.
          </li>
          <li>
            Nếu buddy chưa tập trong ngày, bạn có thể bấm <span className="font-medium">Nhắc {`{tên buddy}`}</span>{" "}
            để gửi tin Zalo nhắc nhẹ.
          </li>
          <li>
            Bạn cũng có thể đổi buddy trong tuần đầu nếu cảm thấy chưa hợp.
          </li>
        </ul>
      </section>

      <section id="rescue" className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          8. Khi mệt hoặc bận – Rescue
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Rescue là hệ thống can thiệp tự động khi BodiX thấy bạn có dấu hiệu
          rời bỏ chương trình. Có 3 mức:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed mb-4">
          <li>
            <span className="font-medium">Mức nhẹ – bỏ 1 ngày:</span> sáng hôm
            sau bạn nhận tin Zalo gợi ý chọn Easy hoặc Recovery để dễ quay
            lại.
          </li>
          <li>
            <span className="font-medium">Mức vừa – bỏ 2 ngày:</span> tin nhắn
            cá nhân hơn, nhắc lại số ngày bạn đã đi được, đề xuất bài 10 phút.
            Buddy của bạn cũng được thông báo (nếu bạn cho phép).
          </li>
          <li>
            <span className="font-medium">Mức cao – bỏ 3 ngày trở lên:</span>{" "}
            tin nhắn động viên dài hơn, không trách móc, kèm link comeback
            vào dashboard. Hệ thống tạm thời giảm cường độ đề xuất xuống Easy.
          </li>
        </ul>
        <p className="text-gray-700 leading-relaxed mb-4">
          Nếu bạn bỏ 7 ngày liên tiếp, enrollment tự động chuyển sang trạng
          thái <span className="font-medium">paused</span>. Chương trình
          không bị mất – bạn có thể resume bất cứ lúc nào từ dashboard.
        </p>
        <p className="text-gray-700 leading-relaxed">
          Bạn cũng có thể chủ động nhấn <span className="font-medium">Tạm
          nghỉ</span> trong Hồ sơ nếu biết trước mình bận (đi công tác, ốm
          dài, sự kiện gia đình). Khi resume, lịch tự dịch chuyển ngày theo
          khoảng nghỉ.
        </p>
      </section>

      <section id="tong-ket" className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          9. Tổng kết tuần và giữa chương trình
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          <span className="font-medium">Tổng kết tuần (Chủ nhật):</span> mỗi
          tuần bạn dành ~25 phút để xem video tổng kết từ coach và điền form
          đánh giá. Form gồm:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed mb-4">
          <li>Mức độ mệt/khỏe trong tuần (1–5).</li>
          <li>Cảm nhận về tiến bộ (1–5).</li>
          <li>Body scan – tự đánh giá vai/lưng/core/mông/đùi/bắp chân/tay.</li>
          <li>Có muốn tăng/giữ/giảm cường độ tuần sau.</li>
        </ul>
        <p className="text-gray-700 leading-relaxed mb-4">
          Trả lời thật để hệ thống điều chỉnh chương trình phù hợp. Nếu bạn
          chọn “muốn nhẹ hơn”, tuần sau số lượt khuyến nghị sẽ giảm.
        </p>
        <p className="text-gray-700 leading-relaxed">
          <span className="font-medium">Reflection giữa chương trình:</span>{" "}
          với BodiX 6W và 12W, ở khoảng giữa lộ trình bạn nhận một form sâu
          hơn – đánh giá thay đổi tổng thể, mức độ hài lòng, gợi ý điều chỉnh
          nửa sau. Đây là thời điểm BodiX hỏi bạn có muốn upgrade lên chương
          trình dài hơn không.
        </p>
      </section>

      <section id="tien-do" className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          10. Theo dõi tiến độ và chuỗi ngày
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Vào tab <span className="font-medium">Tiến độ</span> trên dashboard,
          bạn thấy:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed mb-4">
          <li>
            <span className="font-medium">Chuỗi hiện tại</span> – số ngày
            check-in liên tiếp tính đến hôm nay.
          </li>
          <li>
            <span className="font-medium">Chuỗi dài nhất</span> – kỷ lục cá
            nhân của bạn.
          </li>
          <li>
            <span className="font-medium">Phân bổ cường độ</span> – tổng số
            buổi Hard / Light / Easy / Phục hồi / Tổng kết bạn đã làm.
          </li>
          <li>
            <span className="font-medium">Milestones</span> – các mốc đạt được
            (3 ngày liên tiếp, 7, 14, 21 ngày, hoàn thành tuần, hoàn thành nửa
            chương trình…).
          </li>
          <li>
            <span className="font-medium">Ảnh tiến trình</span> – nếu bạn
            upload ảnh trước/giữa/sau, tab này so sánh chúng cho bạn nhìn rõ
            thay đổi.
          </li>
        </ul>
        <p className="text-gray-700 leading-relaxed">
          Chuỗi ngày tự reset về 0 nếu bạn bỏ 1 ngày trọn vẹn. Để bảo vệ
          chuỗi, BodiX có cơ chế Easy 7 phút – nếu thực sự không thể, ít
          nhất hãy chọn Easy để giữ chuỗi.
        </p>
      </section>

      <section id="hoan-thanh" className="mt-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          11. Hoàn thành chương trình
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Khi bạn đến ngày cuối cùng và check-in, enrollment chuyển sang trạng
          thái <span className="font-medium">completed</span>. Bạn nhận:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed mb-4">
          <li>Milestone hoàn thành chương trình.</li>
          <li>
            Mở khóa upsell sang chương trình dài hơn (BodiX 21 → 6W → 12W).
          </li>
          <li>Có thể chia sẻ thành tích lên cộng đồng cohort.</li>
          <li>
            Nhận credit giới thiệu nếu có người dùng code của bạn để mua trong
            quá trình bạn đang tập.
          </li>
        </ul>
        <p className="text-gray-700 leading-relaxed">
          Bạn có thể lặp lại cùng chương trình để củng cố thói quen, hoặc
          chuyển sang chương trình kế tiếp. Không có giới hạn số lần lặp lại
          BodiX 21.
        </p>
      </section>

      <section id="ho-tro" className="mt-10 mb-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          12. Hỗ trợ và liên hệ
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Có vấn đề kỹ thuật, câu hỏi về chương trình, hoặc cần đổi đợt tập?
          Liên hệ một trong các kênh sau:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed mb-4">
          <li>
            <span className="font-medium">Zalo OA BodiX</span> – nhanh nhất,
            phản hồi trong giờ hành chính.
          </li>
          <li>
            <span className="font-medium">Email:</span>{" "}
            <a
              href="mailto:support@bodix.fit"
              className="text-primary hover:underline"
            >
              support@bodix.fit
            </a>
          </li>
          <li>
            <span className="font-medium">Facebook:</span>{" "}
            <a
              href="https://www.facebook.com/bodixfit"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              facebook.com/bodixfit
            </a>{" "}
            – cập nhật và cộng đồng mở.
          </li>
        </ul>
        <p className="text-gray-700 leading-relaxed">
          Mọi yêu cầu hoàn tiền, xóa tài khoản, đổi đợt tập vui lòng gửi qua
          email. Vui lòng nêu rõ lý do và mã đơn hàng (nếu có).
        </p>
      </section>
    </div>
  );
}
