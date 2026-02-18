export const SITE = {
  name: "BodiX",
  tagline: "Completion First Fitness",
  slogan: "Không phải tập cho vui. Tập để hoàn thành.",
  targetAudience: "Phụ nữ Việt Nam, 20-55 tuổi",
} as const;

export const NAV_ITEMS = [
  { label: "Triết lý", href: "#philosophy" },
  { label: "Chương trình", href: "#programs" },
  { label: "FAQ", href: "#faq" },
] as const;

export const PROGRAMS = [
  {
    id: "bodix-21",
    name: "BodiX 21",
    slug: "/bodix-21",
    duration: "21 ngày",
    tagline: "Nền tảng kỷ luật",
    description:
      "Chương trình khởi đầu dành cho người muốn xây dựng thói quen tập luyện. 21 ngày không đủ để thay đổi cơ thể, nhưng đủ để thay đổi cách bạn nhìn chính mình.",
    features: [
      "Người mới bắt đầu",
      "Người từng bỏ giữa chừng nhiều lần",
      "Người muốn tạo thói quen",
    ],
    cta: "Bắt đầu với 21 ngày",
    highlighted: true,
  },
  {
    id: "bodix-6w",
    name: "BodiX 6W",
    slug: "/bodix-6w",
    duration: "6 tuần",
    tagline: "Bắt đầu thấy form",
    description:
      "Sau khi đã có nền tảng kỷ luật từ BodiX 21, đây là lúc đẩy xa hơn. 6 tuần đủ để cơ thể bắt đầu thích nghi và bạn bắt đầu thấy những thay đổi đầu tiên.",
    features: [
      "Người đã hoàn thành BodiX 21",
      "Người có nền tảng tập luyện cơ bản",
      "Người muốn thấy kết quả rõ hơn",
    ],
    cta: "Xem chương trình 6W",
    highlighted: false,
  },
  {
    id: "bodix-12w",
    name: "BodiX 12W",
    slug: "/bodix-12w",
    duration: "12 tuần",
    tagline: "Thay đổi rõ rệt",
    description:
      "Chương trình toàn diện cho người sẵn sàng cam kết dài hạn. 12 tuần là thời gian đủ để tạo ra thay đổi thực sự về vóc dáng, sức khỏe và lối sống.",
    features: [
      "Người đã có thói quen tập luyện ổn định",
      "Người muốn thay đổi rõ rệt",
      "Người sẵn sàng cam kết 3 tháng",
    ],
    cta: "Xem chương trình 12W",
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
      label: "Số buổi tập",
      values: ["18 buổi", "36 buổi", "72 buổi"],
    },
    {
      label: "Số ngày review",
      values: ["3 ngày", "6 ngày", "12 ngày"],
    },
    {
      label: "Mục tiêu chính",
      values: [
        "Xây dựng thói quen",
        "Tăng sức bền, thấy form",
        "Thay đổi vóc dáng rõ rệt",
      ],
    },
    {
      label: "Cường độ",
      values: ["⚡", "⚡⚡", "⚡⚡⚡"],
    },
    {
      label: "Cần dụng cụ",
      values: ["Không", "Thảm, tạ nhẹ", "Thảm, tạ, dây kháng lực"],
    },
    {
      label: "Phù hợp với",
      values: ["Người mới, hay bỏ cuộc", "Đã có nền tảng", "Sẵn sàng cam kết"],
    },
    {
      label: "Mức cam kết",
      values: ["⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐"],
    },
  ],
} as const;

export const FAQS = [
  {
    question:
      "Tôi hoàn toàn mới, chưa bao giờ tập luyện. Nên bắt đầu từ đâu?",
    answer:
      "Hãy bắt đầu với BodiX 21. Chương trình này được thiết kế dành cho người mới, với cường độ nhẹ và mục tiêu chính là giúp bạn xây dựng thói quen. Bạn không cần có nền tảng gì trước đó.",
  },
  {
    question: "Tôi có cần đến phòng gym không?",
    answer:
      "Không. Tất cả các chương trình BodiX đều có thể tập tại nhà. BodiX 21 không cần bất kỳ dụng cụ nào. BodiX 6W và 12W có thể cần thảm tập và tạ nhẹ, nhưng đều có thể thay thế bằng đồ vật trong nhà.",
  },
  {
    question: "BodiX có phù hợp với nữ không?",
    answer:
      "BodiX được thiết kế dành riêng cho phụ nữ. Các bài tập tập trung vào những vùng cơ thể phụ nữ thường muốn cải thiện như eo, mông, đùi, bắp tay. Cường độ và thời lượng cũng được điều chỉnh phù hợp với thể trạng và lịch trình của phụ nữ.",
  },
  {
    question: "Mỗi ngày tôi cần tập bao lâu?",
    answer:
      "BodiX 21: khoảng 20-30 phút/ngày. BodiX 6W: khoảng 30-40 phút/ngày. BodiX 12W: khoảng 40-50 phút/ngày. Thời gian này bao gồm cả khởi động và giãn cơ.",
  },
  {
    question: "Nếu một hôm tôi quá mệt, không thể tập hết bài thì sao?",
    answer:
      "Trong BodiX, tập ở mức 60-70% vẫn được tính là hoàn thành. Mục tiêu là giữ nhịp, không phải tập kỷ lục. Một buổi tập \"tạm được\" vẫn tốt hơn một buổi tập bị bỏ.",
  },
  {
    question:
      "Sau khi hoàn thành BodiX 21, tôi có bắt buộc phải tiếp tục với 6W không?",
    answer:
      "Không bắt buộc. Bạn có thể lặp lại BodiX 21 nếu muốn củng cố thói quen, hoặc nghỉ ngơi một thời gian trước khi tiếp tục. Tuy nhiên, nếu bạn muốn thấy thay đổi rõ rệt về hình thể, việc tiếp tục với 6W hoặc 12W sẽ mang lại kết quả tốt hơn.",
  },
  {
    question: "Chi phí như thế nào?",
    answer:
      "Chi phí cả tháng tập BodiX không bằng một buổi tập với PT. Bạn có thể xem chi tiết mức phí tại trang của từng chương trình.",
  },
  {
    question: "Tôi có được hỗ trợ gì trong quá trình tập không?",
    answer:
      "Có. BodiX có hệ thống nhắc tập mỗi ngày, theo dõi tiến trình, và cộng đồng để bạn không đơn độc trong hành trình. Bạn cũng có thể đặt câu hỏi và nhận hỗ trợ từ đội ngũ BodiX.",
  },
] as const;

export const CTA_PROGRAMS = [
  { name: "BodiX 21", duration: "21 ngày", href: "/bodix-21", cta: "Bắt đầu →" },
  { name: "BodiX 6W", duration: "6 tuần", href: "/bodix-6w", cta: "Xem 6W →" },
  { name: "BodiX 12W", duration: "12 tuần", href: "/bodix-12w", cta: "Xem 12W →" },
] as const;

export const FOOTER_DATA = {
  brand: {
    name: "BodiX",
    tagline: "Completion First Fitness",
  },
  columns: [
    {
      title: "CHƯƠNG TRÌNH",
      links: [
        { label: "BodiX 21", href: "/bodix-21" },
        { label: "BodiX 6W", href: "/bodix-6w" },
        { label: "BodiX 12W", href: "/bodix-12w" },
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
        { label: "Email", href: "mailto:hello@bodix.vn" },
        { label: "Facebook", href: "#" },
        { label: "Zalo", href: "#" },
      ],
    },
  ],
  copyright: "© 2025 BodiX. All rights reserved.",
} as const;
