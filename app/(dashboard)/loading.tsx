export default function DashboardLoading() {
  return (
    <div className="min-h-screen animate-pulse bg-neutral-50 p-6">
      {/* Page title skeleton */}
      <div className="mb-6 h-7 w-40 rounded-lg bg-neutral-200" />

      {/* Stats row skeleton */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="mb-2 h-3 w-20 rounded bg-neutral-200" />
            <div className="h-8 w-16 rounded bg-neutral-200" />
          </div>
        ))}
      </div>

      {/* Content block skeleton */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <div className="mb-4 h-5 w-32 rounded bg-neutral-200" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-neutral-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 rounded bg-neutral-200" />
                <div className="h-3 w-1/2 rounded bg-neutral-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
