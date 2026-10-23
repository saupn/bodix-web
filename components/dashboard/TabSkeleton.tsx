/**
 * Khung chờ dùng cho loading.tsx của từng tab dashboard: hiện ngay khi bấm
 * chuyển tab, trong lúc server/route chuẩn bị nội dung. Nằm BÊN TRONG shell
 * (header + nav của layout vẫn giữ nguyên).
 */
export function TabSkeleton({
  variant = "cards",
  rows = 3,
}: {
  variant?: "cards" | "list" | "form";
  rows?: number;
}) {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Đang tải">
      <div className="h-8 w-48 rounded-lg bg-neutral-200" />

      {variant === "cards" && (
        <>
          <div className="h-32 rounded-xl border border-neutral-200 bg-white" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl border border-neutral-200 bg-white" />
            ))}
          </div>
        </>
      )}

      {variant === "list" && (
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-neutral-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 rounded bg-neutral-200" />
                <div className="h-3 w-1/2 rounded bg-neutral-200" />
              </div>
            </div>
          ))}
        </div>
      )}

      {variant === "form" && (
        <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 rounded bg-neutral-200" />
              <div className="h-10 rounded-lg bg-neutral-100" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
