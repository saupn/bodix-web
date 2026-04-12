import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";

const FOR_YOU_ITEMS = [
  "Bạn muốn tập tại nhà, không cần đến phòng gym",
  "Bạn đã từng tập rồi bỏ — nhiều lần",
  "Bạn bận rộn nhưng muốn dành 10-25 phút mỗi ngày cho bản thân",
  "Bạn muốn có người đồng hành, không tập một mình",
  "Bạn muốn thấy kết quả, không chỉ \"tập cho có\"",
];

export function Comparison() {
  return (
    <section className="py-12 md:py-20 lg:py-24 bg-neutral-50">
      <div className="container mx-auto px-4 sm:px-6">
        <SectionHeading title="BodiX dành cho bạn nếu..." />
        <div className="mt-8 sm:mt-12 max-w-2xl mx-auto space-y-4">
          {FOR_YOU_ITEMS.map((item) => (
            <div
              key={item}
              className="flex items-start gap-3 rounded-xl bg-white p-4 sm:p-5 border border-neutral-200 shadow-sm"
            >
              <span className="mt-0.5 text-lg text-primary">✓</span>
              <p className="text-neutral-900 text-sm sm:text-base leading-relaxed">
                {item}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8 sm:mt-10 max-w-2xl mx-auto rounded-lg bg-secondary-light p-4 sm:p-5 text-center">
          <p className="text-sm text-neutral-900 leading-relaxed">
            Chương trình hiện tại dành cho Nữ. Phiên bản Nam sắp ra mắt —{" "}
            <Link
              href="/signup"
              className="font-medium text-primary hover:underline"
            >
              đăng ký để nhận thông báo!
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
