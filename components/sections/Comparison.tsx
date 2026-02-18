import { SectionHeading } from "@/components/ui/SectionHeading";
import { COMPARISON_DATA } from "@/lib/constants";

export function Comparison() {
  return (
    <section className="py-12 md:py-20 lg:py-24 bg-neutral-50">
      <div className="container mx-auto px-4 sm:px-6">
        <SectionHeading
          title="So sánh chi tiết"
          subtitle="Chưa biết chọn chương trình nào? Bảng so sánh dưới đây sẽ giúp bạn quyết định."
        />
        <div className="mt-8 sm:mt-12 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <div className="min-w-[500px] sm:min-w-[640px] max-w-4xl mx-auto overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  {COMPARISON_DATA.headers.map((header) => (
                    <th
                      key={header}
                      className="px-3 py-3 sm:px-4 sm:py-4 text-left font-heading text-xs sm:text-sm font-semibold text-primary first:min-w-[100px] sm:first:min-w-[140px]"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_DATA.rows.map((row) => (
                  <tr
                    key={row.label}
                    className="border-b border-neutral-100 last:border-0"
                  >
                    <td className="px-3 py-3 sm:px-4 sm:py-4 text-xs sm:text-sm font-medium text-neutral-700">
                      {row.label}
                    </td>
                    {row.values.map((value) => (
                      <td
                        key={value}
                        className="px-3 py-3 sm:px-4 sm:py-4 text-xs sm:text-sm text-neutral-600"
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-6 sm:mt-8 max-w-2xl mx-auto flex gap-3 rounded-lg bg-secondary-light p-3 sm:p-4">
          <span className="text-2xl shrink-0">💡</span>
          <p className="text-sm text-neutral-700">
            Không chắc nên bắt đầu từ đâu? Nếu bạn chưa từng hoàn thành một
            chương trình tập luyện nào, hãy bắt đầu với BodiX 21. Đó là nền tảng
            cho mọi thứ tiếp theo.
          </p>
        </div>
      </div>
    </section>
  );
}
