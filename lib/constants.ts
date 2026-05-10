export const ZALO_OA_LINK = `https://zalo.me/${process.env.NEXT_PUBLIC_ZALO_OA_ID || "2495331839057844851"}`;

/** Base URL cho link giới thiệu (bodix.fit hoặc bodix.fit) */
export const REFERRAL_BASE =
  process.env.NEXT_PUBLIC_APP_URL || "https://bodix.fit";

/** Tên hiển thị sách tặng (file PDF giữ nguyên public/guides/bodix-fuel-guide.pdf) */
export const GIFT_BOOK_TITLE = "Sách Tại sao nhịn ăn không giúp bạn gọn hơn";

export const GIFT_BOOK_DESCRIPTION =
  "Sách Tại sao nhịn ăn không giúp bạn gọn hơn - Thực ra cần ba thứ - và không phải thứ bạn đang nghĩ. Đây là hướng dẫn thực tế cho phụ nữ bận rộn. Bạn được nhận MIỄN PHÍ!";

export const SITE = {
  name: "BodiX",
  tagline: "Completion First Fitness",
  slogan: "Không phải bạn lười. Chương trình tập cũ thiết kế sai – để bạn bỏ giữa chừng.",
  targetAudience: "Phụ nữ Việt Nam, 25-45 tuổi",
} as const;

export const NAV_ITEMS = [
  { label: "Vì sao BodiX", href: "#why-different" },
  { label: "Chương trình", href: "#programs" },
  { label: "Bảng giá", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

export const PROGRAMS = [
  {
    id: "bodix-21",
    name: "BodiX 21",
    slug: "/bodix-21",
    duration: "21 ngày",
    badge: "⭐ Phổ biến nhất",
    tagline: "21 ngày tạo thói quen",
    description:
      "Dành cho bạn chưa bao giờ hoàn thành một chương trình tập. 21 ngày, mỗi ngày ~7-21 phút. Đây là lần đầu tiên bạn sẽ đi đến cuối.",
    features: [
      "Mỗi ngày ~7-21 phút tùy cường độ",
      "Chọn Hard / Light / Easy theo cảm giác",
      "Tổng kết Chủ nhật mỗi tuần",
    ],
    cta: "Bắt đầu miễn phí 3 ngày",
    highlighted: true,
  },
  {
    id: "bodix-6w",
    name: "BodiX 6W",
    slug: "/bodix-6w",
    duration: "6 tuần",
    badge: "💪 Kết quả rõ rệt",
    tagline: "6 tuần thay đổi rõ rệt",
    description:
      "Dành cho bạn muốn thấy thay đổi thật sự. 2 phiên tập xen kẽ mỗi buổi, ~14-42 phút. Từ tuần 3, bạn sẽ nhìn gương và thấy khác.",
    features: [
      "Mỗi buổi ~14-42 phút tùy cường độ",
      "Kết quả rõ rệt từ tuần thứ 3",
      "Tổng kết chuyên sâu mỗi Chủ nhật",
    ],
    cta: "Bắt đầu miễn phí 3 ngày",
    highlighted: false,
  },
  {
    id: "bodix-12w",
    name: "BodiX 12W",
    slug: "/bodix-12w",
    duration: "12 tuần",
    badge: "🔥 Lột xác toàn diện",
    tagline: "12 tuần lột xác có kiểm soát",
    description:
      "Hành trình đầy đủ nhất. Phiên tập thường + nâng cao, ~14-42 phút. Dành cho bạn nghiêm túc muốn thay đổi cơ thể.",
    features: [
      "Mỗi buổi ~14-42 phút tùy cường độ",
      "Hướng dẫn dinh dưỡng đi kèm",
      "Reflection giữa chương trình",
    ],
    cta: "Bắt đầu miễn phí 3 ngày",
    highlighted: false,
  },
] as const;

export const COMPARISON_DATA = {
  headers: ["Tiêu chí", "BodiX 21", "BodiX 6W", "BodiX 12W"],
  rows: [
    {
      label: "Thời gian",
      values: ["21 ngày", "6 tuần (42 ngày)", "12 tuần (84 ngày)"],
    },
    {
      label: "Thời lượng/buổi",
      values: ["~7-21 phút", "~14-42 phút", "~14-42 phút"],
    },
    {
      label: "Cấu trúc tuần",
      values: ["5 chính + Recovery + Review", "5 chính + Recovery + Review", "5 chính + Recovery + Review"],
    },
    {
      label: "Chế độ tập",
      values: ["Hard / Light / Easy", "Hard / Light / Easy", "Hard / Light / Easy"],
    },
    {
      label: "Mục tiêu chính",
      values: [
        "Tạo thói quen, hoàn thành lần đầu",
        "Thay đổi vóc dáng rõ rệt",
        "Lột xác toàn diện",
      ],
    },
    {
      label: "Phù hợp với",
      values: ["Mới bắt đầu, từng bỏ cuộc", "Muốn thấy kết quả", "Nghiêm túc thay đổi"],
    },
    {
      label: "Giá",
      values: ["499.000đ", "1.199.000đ", "1.999.000đ"],
    },
  ],
} as const;

export const FAQS = [
  {
    question: "Tôi có cần dụng cụ gì không?",
    answer:
      "Không. Tất cả các chương trình BodiX đều tập tại nhà. BodiX 21 không cần bất kỳ dụng cụ nào. BodiX 6W và 12W có thể cần thảm tập và tạ nhẹ, nhưng đều có thể thay thế bằng đồ vật trong nhà.",
  },
  {
    question: "Tự tập tại nhà có sợ tập sai gây chấn thương không?",
    answer:
      "Bài tập trong BodiX được thiết kế tối ưu lên các nhóm cơ chính, với động tác đơn giản và an toàn – gần như không có khả năng gây chấn thương nghiêm trọng. Khác với tạ nặng hay máy gym, các bài tập BodiX dùng trọng lượng cơ thể, kỹ thuật tự nhiên. Quan trọng nhất là bạn vận động đều đặn. Nếu động tác chưa hoàn hảo, cơ thể vẫn được kích hoạt, vẫn đốt calo, vẫn khỏe lên. Không hoàn hảo còn hơn không tập.",
  },
  {
    question: "Bao lâu thì thấy thân mình thay đổi?",
    answer:
      "Phụ nữ thường mong giảm cân nhanh trong 1-2 tuần, nhưng thực tế cần thời gian. Sau 21 ngày tập đều đặn cùng ăn uống lành mạnh, hầu hết thấy thay đổi rõ về dáng đứng, độ săn chắc, năng lượng. Để giảm mỡ thấy rõ trên cân, cần 6-12 tuần kết hợp tập + ăn uống. BodiX không hứa lột xác trong 21 ngày – chúng tôi hứa giúp bạn KHÔNG bỏ giữa chừng, để bạn đi đến điểm thấy kết quả.",
  },
  {
    question: "Có cần khởi động và giãn cơ không?",
    answer:
      "Có, nhưng đơn giản. Trước buổi tập: đi bộ tại chỗ 1-2 phút, xoay khớp vai/hông/cổ tay. Sau buổi tập: ngồi gập người chạm chân, kéo căng nhẹ tay/chân/lưng 30 giây mỗi nhóm. Bạn có thể dùng cách khởi động/giãn cơ mình đã biết – BodiX không bắt buộc theo công thức cứng.",
  },
  {
    question: "Có thể tập ở công viên hoặc sân với bạn bè không?",
    answer:
      "Hoàn toàn có thể. Bài tập BodiX không cần dụng cụ phức tạp, chỉ cần không gian khoảng 2x2m. Tập ngoài trời với buddy hoặc nhóm bạn còn vui hơn và giúp duy trì động lực tốt hơn.",
  },
  {
    question:
      "Tôi hoàn toàn mới, chưa bao giờ tập luyện. Có phù hợp không?",
    answer:
      "Chương trình thiết kế cho phụ nữ ở mọi mức độ thể lực. Mục tiêu không phải xây thói quen – mà giúp bạn duy trì động lực để tập đều đặn và HOÀN THÀNH chương trình. Mỗi ngày có 3 mức cường độ (3 lượt – 2 lượt – 1 lượt) để bạn chọn theo cảm giác cơ thể.",
  },
  {
    question: "BodiX khác gì với các chương trình online khác?",
    answer:
      "Phần lớn chương trình online tập trung vào nội dung bài tập. BodiX tập trung vào việc giúp bạn HOÀN THÀNH: có rescue khi bạn mệt, có buddy cùng đợt khi bạn nản, có nhắc tập qua Zalo, có tổng kết tuần. Chúng tôi đo bạn có đi đến cuối hay không – chứ không chỉ phát video.",
  },
  {
    question: "Mỗi ngày tôi cần tập bao lâu?",
    answer:
      "Tùy bạn chọn! Mỗi ngày bạn chọn 1 trong 3 mức: Hard (3 lượt, ~21 phút), Light (2 lượt, ~14 phút), hoặc Easy (1 lượt, ~7 phút). Thứ 7 là phiên phục hồi ~7 phút, Chủ nhật là Tổng kết ~25 phút.",
  },
  {
    question: "Nếu một hôm tôi quá mệt, không thể tập được thì sao?",
    answer:
      "Đó chính là lý do BodiX có chế độ Easy – chỉ 1 lượt, ~7 phút. Ngày mệt, bạn chọn Easy thay vì bỏ. Giữ nhịp quan trọng hơn cường độ. Nếu bạn bỏ 2 ngày, hệ thống sẽ nhắn nhẹ qua Zalo để kéo bạn lại.",
  },
  {
    question: "BodiX có phù hợp với nam không?",
    answer:
      "Hiện tại BodiX được thiết kế dành riêng cho phụ nữ. Các bài tập tập trung vào những vùng cơ thể phụ nữ thường muốn cải thiện. Phiên bản dành cho nam đang được phát triển và sẽ ra mắt sớm!",
  },
  {
    question: "Chi phí như thế nào?",
    answer:
      "BodiX 21 chỉ 499.000đ (~24.000đ/ngày, rẻ hơn ly trà sữa). Thanh toán 1 lần, không subscription, không phí ẩn. Bạn được trải nghiệm miễn phí 3 ngày trước khi quyết định.",
  },
  {
    question: "Tổng kết Chủ nhật là gì?",
    answer:
      "Mỗi Chủ nhật, bạn xem video nhận xét từ coach, tự đánh giá cơ thể (body scan), và đặt mục tiêu cho tuần mới. Đây là lúc bạn dừng lại, lắng nghe cơ thể, và thấy mình đang tiến lên.",
  },
] as const;

export const CTA_PROGRAMS = [
  { name: "BodiX 21", duration: "21 ngày", href: "/signup", cta: "Bắt đầu miễn phí →" },
  { name: "BodiX 6W", duration: "6 tuần", href: "/signup", cta: "Bắt đầu miễn phí →" },
  { name: "BodiX 12W", duration: "12 tuần", href: "/signup", cta: "Bắt đầu miễn phí →" },
] as const;

export const FOOTER_DATA = {
  brand: {
    name: "BodiX",
    tagline: "Completion First Fitness – Dành cho phụ nữ Việt Nam",
  },
  columns: [
    {
      title: "CHƯƠNG TRÌNH",
      links: [
        { label: "BodiX 21", href: "/bodix-21" },
        { label: "BodiX 6W", href: "/bodix-6w" },
        { label: "BodiX 12W", href: "/bodix-12w" },
        { label: "Dành cho Nam (Sắp ra mắt)", href: "#" },
      ],
    },
    {
      title: "HỖ TRỢ",
      links: [
        { label: "FAQ", href: "/#faq" },
        { label: "Hướng dẫn", href: "/huong-dan" },
        { label: "Điều khoản", href: "/dieu-khoan" },
        { label: "Bảo mật", href: "/bao-mat" },
      ],
    },
    {
      title: "LIÊN HỆ",
      links: [
        { label: "Email", href: "mailto:office@bodix.fit" },
        { label: "Facebook", href: "https://www.facebook.com/bodixfit" },
        { label: "Zalo", href: "https://zalo.me/2495331839057844851" },
      ],
    },
  ],
  copyright: "© 2025 BodiX. All rights reserved.",
} as const;
