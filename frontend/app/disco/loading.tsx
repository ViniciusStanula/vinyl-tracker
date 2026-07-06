export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Heading skeleton */}
      <div className="h-9 w-56 bg-groove rounded-lg mb-4 animate-pulse" />

      {/* SortBar skeleton */}
      <div className="sticky top-[62px] z-40 -mx-4 px-4 pt-2 pb-2 bg-record/95 backdrop-blur-md mb-3">
        <div className="h-14 bg-sleeve border border-groove rounded-xl animate-pulse" />
      </div>

      {/* Result count skeleton */}
      <div className="h-4 w-36 bg-groove rounded animate-pulse mb-5" />

      {/* Card grid skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="bg-sleeve border border-groove rounded-xl overflow-hidden animate-pulse"
          >
            <div className="aspect-square bg-label" />
            <div className="p-4 space-y-2">
              <div className="h-2.5 bg-groove rounded w-1/2" />
              <div className="h-3.5 bg-groove rounded" />
              <div className="h-3.5 bg-groove rounded w-3/4" />
              <div className="h-5 bg-wax/40 rounded w-1/3 mt-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
