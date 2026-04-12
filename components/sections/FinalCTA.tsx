import Link from "next/link";

export function FinalCTA() {
  return (
    <section className="py-12 md:py-20 lg:py-24 bg-primary text-white">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-heading text-lg font-bold sm:text-xl">
            Lần này, bạn sẽ đi đến cuối
          </h2>
          <p className="mt-4 text-base sm:text-lg opacity-90 leading-relaxed">
            3 ngày trải nghiệm miễn phí. Không cần thẻ tín dụng. Không cam kết.
            Chỉ cần bạn sẵn sàng bắt đầu.
          </p>
          <div className="mt-8">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-lg border-2 border-white bg-white px-8 py-4 text-base font-semibold text-primary transition-colors hover:bg-white/90"
            >
              Bắt đầu miễn phí 3 ngày
            </Link>
          </div>
          <p className="mt-4 text-sm opacity-70">
            Chương trình dành cho Nữ. Phiên bản Nam sắp ra mắt!
          </p>
        </div>
      </div>
    </section>
  );
}
