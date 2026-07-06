export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Back link + heading skeleton */}
      <div className="mb-4">
        <div className="h-4 w-16 bg-groove rounded animate-pulse mb-4" />
        <div className="h-10 w-64 bg-sleeve border border-groove rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-80 bg-groove rounded animate-pulse" />
      </div>

      {/* SortBar skeleton */}
      <div className="sticky top-[62px] z-40 -mx-4 px-4 pt-2 pb-2 bg-record/95 backdrop-blur-md mb-3">
        <div className="h-14 bg-sleeve border border-groove rounded-xl animate-pulse" />
      </div>

      {/* Card grid skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="bg-sleeve border border-groove rounded-xl overflow-hidden animate-pulse"
          >
            <div className="aspect-square bg-label" />
            <div className="p-4 space-y-2">
              <div className="h-2.5 bg-groove rounded w-1/2" />
              <div className="h-3.5 bg-groove rounded" />
              <div className="h-3.5 bg-groove rounded w-3/4" />
              <div className="h-5 bg-wax/40 rounded w-1/3 mt-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
