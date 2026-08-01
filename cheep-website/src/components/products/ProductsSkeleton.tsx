/**
 * Ürün ızgarası iskeleti.
 *
 * Boş bir alan yerine kartların şeklini gösterir: yerleşim zıplamaz ve
 * kullanıcı ne geleceğini bilir. Filtre değiştirilirken görünür.
 */
export function ProductsSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div
      aria-busy="true"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col rounded-2xl border border-line bg-paper p-4">
          <div className="mb-3 h-28 animate-pulse rounded-xl bg-cream-deep" />
          <div className="h-4 w-11/12 animate-pulse rounded bg-cream-deep" />
          <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-cream-deep" />
          <div className="mt-auto pt-4">
            <div className="h-3 w-1/3 animate-pulse rounded bg-cream-deep" />
            <div className="mt-2 h-6 w-1/2 animate-pulse rounded bg-cream-deep" />
          </div>
        </div>
      ))}
    </div>
  )
}
