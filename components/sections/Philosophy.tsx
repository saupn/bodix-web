import { Target, RefreshCw, BarChart3 } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

const features = [
  {
    icon: Target,
    title: "Thiết kế để hoàn thành",
    description: "Không phải thiết kế để \"cháy\" rồi bỏ",
  },
  {
    icon: RefreshCw,
    title: "Cấu trúc 6 + 1",
    description: "6 ngày tập + 1 ngày review mỗi tuần",
  },
  {
    icon: BarChart3,
    title: "Nhịp quan trọng hơn cường độ",
    description: "Tập vừa phải nhưng đều đặn, không đứt nhịp",
  },
];

export function Philosophy() {
  return (
    <section id="philosophy" className="py-12 md:py-20 lg:py-24 bg-secondary">
      <div className="container mx-auto px-4 sm:px-6">
        <SectionHeading
          title="COMPLETION FIRST"
          subtitle="Hoàn thành quan trọng hơn hoàn hảo"
        />
        <div className="mt-8 sm:mt-12 max-w-3xl mx-auto space-y-4 sm:space-y-6 text-neutral-700 text-base sm:text-lg leading-relaxed">
          <p>
            Vấn đề lớn nhất của fitness không phải là thiếu bài tập. YouTube có
            hàng triệu video. Instagram có vô số hướng dẫn. Bạn không thiếu thông
            tin.
          </p>
          <p className="font-semibold text-primary text-xl">
            Vấn đề lớn nhất là bỏ giữa chừng.
          </p>
          <p>
            BodiX được xây dựng trên một nguyên tắc khác: Completion First. Mọi
            thứ trong chương trình, từ cấu trúc 6+1, cường độ vừa phải, đến hệ
            thống nhắc nhịp, đều được thiết kế với một mục tiêu duy nhất: tối đa
            hóa tỷ lệ hoàn thành.
          </p>
          <p>Vì khi bạn hoàn thành, mọi thứ khác sẽ đến sau.</p>
        </div>
        <div className="mt-10 sm:mt-16 grid gap-6 sm:gap-8 sm:grid-cols-2 md:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-xl bg-white p-4 sm:p-6 border border-neutral-200 shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-semibold text-primary">
                {title}
              </h3>
              <p className="mt-2 text-neutral-600">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
