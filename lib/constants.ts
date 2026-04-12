export const ZALO_OA_LINK = `https://zalo.me/${process.env.NEXT_PUBLIC_ZALO_OA_ID || "2495331839057844851"}`;

/** Base URL cho link giới thiệu (bodix.fit hoặc bodix.vn) */
export const REFERRAL_BASE =
  process.env.NEXT_PUBLIC_APP_URL || "https://bodix.fit";

export const SITE = {
  name: "BodiX",
  tagline: "Completion First Fitness",
  slogan: "Thay đổi vóc dáng tại nhà — không cần phòng tập, không cần PT",
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
      "Review Chủ nhật mỗi tuần",
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
      "Review chuyên sâu mỗi Chủ nhật",
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
    question:
      "Tôi hoàn toàn mới, chưa bao giờ tập luyện. Nên bắt đầu từ đâu?",
    answer:
      "Hãy bắt đầu với BodiX 21. Chương trình này được thiết kế dành cho người mới, với cường độ nhẹ và mục tiêu chính là giúp bạn xây dựng thói quen. Ngày nào mệt, bạn chọn Easy chỉ 10 phút. Bạn không cần có nền tảng gì trước đó.",
  },
  {
    question: "Tôi có cần đến phòng gym không?",
    answer:
      "Không. Tất cả các chương trình BodiX đều tập tại nhà. BodiX 21 không cần bất kỳ dụng cụ nào. BodiX 6W và 12W có thể cần thảm tập và tạ nhẹ, nhưng đều có thể thay thế bằng đồ vật trong nhà.",
  },
  {
    question: "BodiX có phù hợp với nam không?",
    answer:
      "Hiện tại BodiX được thiết kế dành riêng cho phụ nữ. Các bài tập tập trung vào những vùng cơ thể phụ nữ thường muốn cải thiện. Phiên bản dành cho nam đang được phát triển và sẽ ra mắt sớm!",
  },
  {
    question: "Mỗi ngày tôi cần tập bao lâu?",
    answer:
      "Tùy bạn chọn! Mỗi ngày bạn chọn 1 trong 3 mức: Hard (3 lượt, ~21 phút), Light (2 lượt, ~14 phút), hoặc Easy (1 lượt, ~7 phút). Thứ 7 là phiên phục hồi ~7 phút, Chủ nhật là Review ~25 phút.",
  },
  {
    question: "Nếu một hôm tôi quá mệt, không thể tập được thì sao?",
    answer:
      "Đó chính là lý do BodiX có chế độ Easy — chỉ 1 lượt, ~7 phút. Ngày mệt, bạn chọn Easy thay vì bỏ. Giữ nhịp quan trọng hơn cường độ. Nếu bạn bỏ 2 ngày, hệ thống sẽ nhắn nhẹ qua Zalo để kéo bạn lại.",
  },
  {
    question:
      "Sau khi hoàn thành BodiX 21, tôi có bắt buộc phải tiếp tục với 6W không?",
    answer:
      "Không bắt buộc. Bạn có thể lặp lại BodiX 21 nếu muốn củng cố thói quen, hoặc nghỉ ngơi trước khi tiếp tục. Tuy nhiên, nếu bạn muốn thấy thay đổi rõ rệt về hình thể, việc tiếp tục với 6W hoặc 12W sẽ mang lại kết quả tốt hơn.",
  },
  {
    question: "Chi phí như thế nào?",
    answer:
      "BodiX 21 chỉ 499.000đ (~24.000đ/ngày, rẻ hơn ly trà sữa). Thanh toán 1 lần, không subscription, không phí ẩn. Bạn được trải nghiệm miễn phí 3 ngày trước khi quyết định.",
  },
  {
    question: "Review Chủ nhật là gì?",
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
    tagline: "Completion First Fitness — Dành cho phụ nữ Việt Nam",
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
        { label: "Hướng dẫn", href: "#" },
        { label: "Điều khoản", href: "#" },
        { label: "Bảo mật", href: "#" },
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
