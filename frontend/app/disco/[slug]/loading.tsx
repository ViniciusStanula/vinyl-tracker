export default function Loading() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb skeleton */}
      <div className="h-4 w-48 bg-groove rounded animate-pulse mb-6" />

      {/* Hero — album art + details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 mb-6">
        <div className="lg:col-span-5">
          <div className="aspect-square bg-sleeve border border-groove rounded-2xl animate-pulse" />
        </div>
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="h-3 w-32 bg-groove rounded animate-pulse" />
            <div className="h-8 w-full bg-sleeve border border-groove rounded-lg animate-pulse" />
            <div className="h-8 w-3/4 bg-sleeve border border-groove rounded-lg animate-pulse" />
          </div>
          <div className="mt-6 space-y-3">
            <div className="h-5 w-36 bg-groove rounded animate-pulse" />
            <div className="h-4 w-24 bg-groove rounded animate-pulse" />
            <div className="h-14 w-full bg-wax/40 rounded-xl animate-pulse mt-2" />
            <div className="h-3 w-48 bg-groove rounded animate-pulse" />
            <div className="h-16 bg-sleeve border border-groove rounded-xl animate-pulse mt-2" />
          </div>
        </div>
      </div>

      {/* Tabs + content skeleton */}
      <div className="bg-sleeve border border-groove rounded-xl p-4 mb-6 animate-pulse">
        <div className="flex gap-4 mb-4">
          <div className="h-8 w-24 bg-groove rounded-lg" />
          <div className="h-8 w-24 bg-groove/50 rounded-lg" />
        </div>
        <div className="h-40 bg-groove rounded-lg" />
      </div>

      {/* Related deals skeleton */}
      <div className="mt-6">
        <div className="h-7 w-52 bg-sleeve border border-groove rounded-lg animate-pulse mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-sleeve border border-groove rounded-xl overflow-hidden animate-pulse"
            >
              <div className="aspect-square bg-label" />
              <div className="p-3 space-y-2">
                <div className="h-2.5 bg-groove rounded w-1/2" />
                <div className="h-3.5 bg-groove rounded" />
                <div className="h-5 bg-wax/40 rounded w-1/3 mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
