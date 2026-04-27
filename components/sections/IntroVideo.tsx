'use client';

export default function IntroVideo() {
  return (
    <section className="py-16 px-4 bg-gray-50">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
          Tại sao 90% phụ nữ bỏ tập giữa chừng?
        </h2>
        <p className="text-gray-600 mb-8">
          4 phút để hiểu cách BodiX giúp bạn hoàn thành – không phải hoàn hảo.
        </p>

        <div className="relative rounded-2xl overflow-hidden shadow-xl" style={{ paddingTop: '56.34%' }}>
          <iframe
            src="https://player.vimeo.com/video/1186823016?badge=0&autopause=0&player_id=0&app_id=58479&rel=0"
            className="absolute top-0 left-0 w-full h-full"
            frameBorder="0"
            allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            title="Giới thiệu BodiX"
          />
        </div>

        <p className="mt-6 text-sm text-gray-500">
          Xem xong? Bắt đầu tập thử 3 ngày miễn phí.
        </p>
        <a
          href="/signup"
          className="inline-block mt-3 px-8 py-3 bg-[#2D4A3E] text-white rounded-xl font-medium hover:bg-[#1a2e26] transition"
        >
          Đăng ký tập thử
        </a>
      </div>
    </section>
  );
}
