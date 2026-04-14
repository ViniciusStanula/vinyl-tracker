import Link from "next/link";

type SearchParams = {
  q?: string;
  sort?: string;
  artista?: string;
};

function buildUrl(page: number, sp: SearchParams): string {
  const params = new URLSearchParams();
  if (sp.q) params.set("q", sp.q);
  // Only include sort when it's not the default so URLs stay clean
  if (sp.sort && sp.sort !== "desconto") params.set("sort", sp.sort);
  if (sp.artista) params.set("artista", sp.artista);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

/** Returns a mixed array of page numbers and ellipsis markers. */
function pageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  const lo = Math.max(2, current - 2);
  const hi = Math.min(total - 1, current + 2);
  for (let p = lo; p <= hi; p++) pages.push(p);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

export default function Pagination({
  currentPage,
  totalPages,
  searchParams,
}: {
  currentPage: number;
  totalPages: number;
  searchParams: SearchParams;
}) {
  const pages = pageRange(currentPage, totalPages);

  const btnBase =
    "flex items-center justify-center text-sm rounded-lg transition-colors";
  const btnActive =
    "bg-amber-500 text-zinc-950 font-semibold";
  const btnIdle =
    "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100";
  const btnDisabled =
    "bg-zinc-900 text-zinc-600 cursor-not-allowed select-none";

  return (
    <nav
      aria-label="Navegação de páginas"
      className="flex items-center justify-center gap-1 mt-10 flex-wrap"
    >
      {/* Previous */}
      {currentPage > 1 ? (
        <Link
          href={buildUrl(currentPage - 1, searchParams)}
          className={`${btnBase} ${btnIdle} px-3 py-1.5`}
        >
          ← Anterior
        </Link>
      ) : (
        <span className={`${btnBase} ${btnDisabled} px-3 py-1.5`}>
          ← Anterior
        </span>
      )}

      {/* Page numbers */}
      {pages.map((p, i) =>
        p === "..." ? (
          <span
            key={`ellipsis-${i}`}
            className="px-1.5 text-zinc-500 text-sm select-none"
          >
            …
          </span>
        ) : (
          <Link
            key={p}
            href={buildUrl(p, searchParams)}
            aria-current={p === currentPage ? "page" : undefined}
            className={`${btnBase} ${p === currentPage ? btnActive : btnIdle} w-9 h-9`}
          >
            {p}
          </Link>
        )
      )}

      {/* Next */}
      {currentPage < totalPages ? (
        <Link
          href={buildUrl(currentPage + 1, searchParams)}
          className={`${btnBase} ${btnIdle} px-3 py-1.5`}
        >
          Próxima →
        </Link>
      ) : (
        <span className={`${btnBase} ${btnDisabled} px-3 py-1.5`}>
          Próxima →
        </span>
      )}
    </nav>
  );
}
