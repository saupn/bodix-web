/**
 * FAQ database + matcher cho Zalo OA webhook (BD-ZALO-WEBHOOK-FAQ-REPLY).
 *
 * Thay logic state-aware cũ: thay vì kể lại trạng thái user, ta pattern-match
 * câu hỏi → trả lời từ FAQ; không match → fallback "sẽ có người trả lời".
 * KHÔNG dùng AI API. Match tolerant: lowercase + bỏ dấu để "giam can" và
 * "giảm cân" cùng khớp.
 */

export type FAQEntry = {
  id: string;
  keywords: string[]; // các pattern keyword match
  answer: string;
};

export const FAQ_DATABASE: FAQEntry[] = [
  // Nhóm A: Giá & Thanh toán
  {
    id: 'price',
    keywords: ['giá bao nhiêu', 'bao nhiêu tiền', 'chi phí', 'phí tham gia', 'học phí', 'giá khoá', 'cost', 'price'],
    answer: 'BodiX 21 (21 ngày): 499.000đ. BodiX 6 tuần: 1.199.000đ. BodiX 12 tuần: 1.999.000đ. Bạn xem chi tiết tại bodix.fit/programs.',
  },
  {
    id: 'discount',
    keywords: ['giảm giá', 'khuyến mãi', 'discount', 'sale', 'voucher', 'mã giảm'],
    answer: 'Khi bạn được giới thiệu qua link bạn bè, bạn được giảm 10% cho khoá đầu tiên. Bạn có thể tìm link giới thiệu từ người quen đã tham gia BodiX.',
  },
  {
    id: 'payment_method',
    keywords: ['thanh toán bằng', 'phương thức thanh toán', 'chuyển khoản', 'trả tiền'],
    answer: 'BodiX nhận thanh toán qua chuyển khoản ngân hàng (quét mã QR Code). Sau khi đăng ký, bạn có thể bấm vào nút “Thanh toán ngay” trên trang bodix.fit/app.',
  },
  {
    id: 'refund',
    keywords: ['hoàn tiền', 'refund', 'trả lại tiền', 'huỷ thanh toán'],
    answer: 'Hiện tại BodiX chưa có chính sách hoàn tiền. Bạn có 3 ngày tập thử miễn phí trước khi quyết định thanh toán.',
  },
  {
    id: 'installment',
    keywords: ['trả góp', 'chia nhỏ', 'trả nhiều lần', 'instalment'],
    answer: 'Hiện tại BodiX chỉ nhận thanh toán 1 lần khi đăng ký.',
  },
  {
    id: 'payment_issue',
    keywords: ['đã thanh toán nhưng', 'thanh toán rồi mà', 'chuyển tiền rồi', 'không vào được'],
    answer: 'Cảm ơn bạn. Chúng tôi sẽ kiểm tra và phản hồi sớm nhất.',
  },

  // Nhóm B: Chương trình & Cách tập
  {
    id: 'weight_loss',
    keywords: ['giảm cân', 'giảm mỡ', 'gọn', 'thon gọn', 'sút cân', 'down cân'],
    answer: 'BodiX giúp bạn xây thói quen tập đều đặn và cải thiện hình thể. Kết quả cụ thể phụ thuộc vào việc bạn hoàn thành chương trình và chế độ ăn.',
  },
  {
    id: 'duration',
    keywords: ['bao lâu', 'thời lượng', 'mất bao nhiêu phút', 'tập mấy phút', 'một buổi', 'một bài'],
    answer: 'Mỗi buổi tập từ 14 đến 21 phút, tùy phiên bản (Easy/Hard) bạn chọn.',
  },
  {
    id: 'where_equipment',
    keywords: ['tập ở đâu', 'phòng gym', 'gym', 'dụng cụ', 'thiết bị', 'cần gì', 'tập tại nhà'],
    answer: 'BodiX thiết kế cho tập tại nhà. Bạn chỉ cần một góc trống và thảm tập là đủ. Không cần dụng cụ.',
  },
  {
    id: 'makeup',
    keywords: ['tập bù', 'quên 1 buổi', 'quên buổi', 'bỏ ngày', 'bỏ một buổi', 'nghỉ tập'],
    answer: 'Có. Nếu bạn bỏ 1 buổi, hệ thống sẽ giúp bạn quay lại nhịp tập bằng phiên bản Easy nhẹ hơn. Quan trọng là tiếp tục, không phải hoàn hảo.',
  },
  {
    id: 'beginner',
    keywords: ['mới tập', 'người mới', 'chưa từng tập', 'beginner', 'mới bắt đầu', 'có theo được'],
    answer: 'BodiX được thiết kế cho người mới bắt đầu. Mỗi buổi có phiên bản Easy phù hợp với người chưa quen tập.',
  },
  {
    id: 'nutrition',
    keywords: ['ăn kiêng', 'chế độ ăn', 'nutrition', 'eat', 'ăn gì', 'thực đơn'],
    answer: 'BodiX không bắt buộc ăn kiêng. Nhưng để có kết quả rõ rệt, bạn nên ăn đủ chất và hạn chế đồ ngọt/dầu mỡ.',
  },
  {
    id: 'gender',
    keywords: ['nam giới', 'con trai', 'đàn ông', 'dành cho ai', 'nam tập', 'male'],
    answer: 'BodiX thiết kế chính cho phụ nữ 25–42 tuổi muốn cải thiện hình thể. Nam giới vẫn có thể tham gia.',
  },
  {
    id: 'video_guide',
    keywords: ['hướng dẫn', 'video', 'cách thực hiện', 'động tác', 'kỹ thuật'],
    answer: 'Mỗi buổi tập có video hướng dẫn chi tiết từng động tác. Bạn xem trong app.',
  },

  // Nhóm C: Trial & Đăng ký
  {
    id: 'trial',
    keywords: ['tập thử', 'trial', 'dùng thử', 'miễn phí', 'free', 'free trial'],
    answer: 'Bạn được tập thử miễn phí 3 ngày để trải nghiệm BodiX. Sau đó bạn quyết định có đăng ký khoá đầy đủ hay không.',
  },
  {
    id: 'how_signup',
    keywords: ['đăng ký như thế nào', 'sign up', 'cách tham gia', 'làm sao tham gia', 'tham gia ở đâu'],
    answer: 'Bạn đăng ký tại bodix.fit. Chỉ cần số điện thoại và làm theo hướng dẫn.',
  },
  {
    id: 'access_issue',
    keywords: ['chưa thấy bài', 'không vào được trial', 'app không hoạt động', 'lỗi app', 'lỗi web'],
    answer: 'Cảm ơn bạn. Chúng tôi sẽ kiểm tra và phản hồi sớm nhất.',
  },
  {
    id: 'cohort_start',
    keywords: ['khi nào bắt đầu', 'cohort', 'đợt tập', 'ngày bắt đầu', 'lịch tập'],
    answer: 'Bạn xem ngày đợt tập gần nhất tại bodix.fit/app sau khi đăng ký.',
  },
  {
    id: 'mobile_app',
    keywords: ['app điện thoại', 'ios', 'android', 'download app', 'tải app', 'mobile'],
    answer: 'Hiện tại BodiX chạy trên trình duyệt tại bodix.fit. App mobile sẽ ra mắt trong thời gian tới.',
  },

  // Nhóm D: Cộng đồng & Buddy
  {
    id: 'community',
    keywords: ['cộng đồng', 'group', 'nhóm tập', 'có ai tập cùng'],
    answer: 'Mỗi đợt tập có cộng đồng cohort riêng để các bạn cùng đồng hành. Bạn sẽ được thêm vào sau khi đăng ký.',
  },
  {
    id: 'buddy',
    keywords: ['buddy', 'bạn đồng hành', 'bạn tập', 'partner', 'cùng tập với'],
    answer: 'Buddy là bạn cùng tập trong đợt cohort của bạn. Hai người sẽ động viên nhau hoàn thành chương trình.',
  },
  {
    id: 'coach',
    keywords: ['coach', 'hlv', 'huấn luyện viên', 'pt', 'personal trainer'],
    answer: 'BodiX vận hành bằng hệ thống, không có HLV 1–1. Mỗi câu hỏi của bạn sẽ được đội ngũ BodiX trả lời qua Zalo.',
  },

  // Nhóm E: Referral & Affiliate
  {
    id: 'referral_code',
    keywords: ['mã giới thiệu', 'referral code', 'mã của tôi', 'link giới thiệu'],
    answer: 'Mỗi user đều có mã giới thiệu riêng. Bạn xem mã của mình tại bodix.fit/app/referral.',
  },
  {
    id: 'referral_reward',
    keywords: ['giới thiệu được lợi', 'thưởng giới thiệu', 'mời bạn được gì', 'lợi ích giới thiệu'],
    answer: 'Khi bạn bè đăng ký qua link của bạn, bạn nhận voucher 100.000đ (sau khi bạn ấy bắt đầu tập). Bạn bè được giảm 10%.',
  },
  {
    id: 'affiliate',
    keywords: ['affiliate', 'hợp tác', 'đối tác', 'kol', 'partner program', 'làm đại lý'],
    answer: 'BodiX có chương trình Đối tác (40% hoa hồng). Bạn đăng ký tại bodix.fit/affiliate.',
  },
  {
    id: 'when_receive_reward',
    keywords: ['khi nào nhận voucher', 'khi nào có hoa hồng', 'commission', 'bao giờ nhận tiền'],
    answer: 'Voucher/hoa hồng được kích hoạt khi người được giới thiệu hoàn thành thanh toán và check-in ngày đầu tập.',
  },

  // Nhóm F: Khác
  {
    id: 'contact',
    keywords: ['liên hệ', 'contact', 'hotline', 'số điện thoại', 'gọi điện', 'email'],
    answer: 'Bạn liên hệ trực tiếp qua Zalo OA này. Chúng tôi sẽ phản hồi sớm nhất.',
  },
  {
    id: 'password',
    keywords: ['quên mật khẩu', 'không đăng nhập được', 'login lỗi', 'reset password', 'forgot password'],
    answer: 'Bạn vào bodix.fit và bấm "Quên mật khẩu" để đặt lại.',
  },
  {
    id: 'delete_account',
    keywords: ['huỷ đăng ký', 'xoá tài khoản', 'xoá thông tin', 'delete account'],
    answer: 'Bạn liên hệ chúng tôi qua Zalo OA này để được hỗ trợ xoá tài khoản.',
  },
  {
    id: 'thanks',
    keywords: ['cảm ơn', 'thank', 'thanks', 'cám ơn', 'tks'],
    answer: 'Cảm ơn bạn đã đồng hành cùng BodiX!',
  },
];

/** Chuẩn hoá: lowercase + bỏ dấu tiếng Việt + đ→d + gộp khoảng trắng. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đ]/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchFAQ(userMessage: string): FAQEntry | null {
  if (!userMessage || userMessage.trim().length === 0) return null;

  const normalized = normalize(userMessage);

  for (const entry of FAQ_DATABASE) {
    for (const keyword of entry.keywords) {
      const normalizedKeyword = keyword
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[đ]/g, 'd');

      if (normalized.includes(normalizedKeyword)) {
        return entry;
      }
    }
  }

  return null;
}

export const FALLBACK_REPLY =
  'Cảm ơn bạn đã liên hệ BodiX. Câu hỏi của bạn sẽ được đội ngũ phản hồi trong thời gian sớm nhất. Trong khi chờ, bạn có thể xem thông tin chương trình tại bodix.fit/programs.';

/** Tin nhắn "vớ vẩn": quá ngắn, chỉ emoji/dấu, hoặc ký tự lặp. */
export function isNonsenseMessage(userMessage: string): boolean {
  const trimmed = userMessage.trim();

  // Quá ngắn
  if (trimmed.length < 2) return true;

  // Chỉ emoji + dấu (loại bỏ chữ và số)
  const textOnly = trimmed.replace(/[\p{Emoji}\p{P}\s]/gu, '');
  if (textOnly.length === 0) return true;

  // Ký tự lặp (cùng 1 ký tự lặp > 5 lần)
  if (/(.)\1{5,}/.test(trimmed)) return true;

  return false;
}

export const NONSENSE_REPLY =
  'Cảm ơn bạn. Nếu bạn có câu hỏi cụ thể về BodiX, hãy nhắn lại để chúng tôi hỗ trợ nhé!';
