"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import DiscoCard from "./DiscoCard";
import Pagination from "./Pagination";
import type { ProcessedDisco } from "@/lib/queryDiscos";

type SearchParams = {
  q?: string;
  sort?: string;
  artista?: string;
  precoMax?: string;
};

interface InfiniteGridProps {
  initialItems: ProcessedDisco[];
  currentPage: number;
  totalPages: number;
  searchParams: SearchParams;
  animationKey: string;
  basePath?: string;
}

export default function InfiniteGrid({
  initialItems,
  currentPage,
  totalPages,
  searchParams,
  animationKey,
  basePath = "/disco",
}: InfiniteGridProps) {
  const [mode, setMode] = useState<"paginate" | "infinite">("paginate");
  const [items, setItems] = useState<ProcessedDisco[]>(initialItems);
  const [nextPage, setNextPage] = useState(currentPage + 1);
  const [hasMore, setHasMore] = useState(currentPage < totalPages);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const sentinelRef   = useRef<HTMLDivElement>(null);
  const gridRef       = useRef<HTMLUListElement>(null);
  const prevAnimKey   = useRef(animationKey);

  // Read scroll mode preference from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem("garimpaScrollMode");
    if (saved === "infinite" || saved === "paginate") setMode(saved);
  }, []);

  // Reset grid whenever the server re-renders with new filter/sort data
  useEffect(() => {
    setItems(initialItems);
    setNextPage(currentPage + 1);
    setHasMore(currentPage < totalPages);
  }, [initialItems, currentPage, totalPages]);

  // Fade-in animation on filter / sort changes
  useEffect(() => {
    if (animationKey === prevAnimKey.current) return;
    prevAnimKey.current = animationKey;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gridRef.current?.animate(
      [{ opacity: 0.1 }, { opacity: 1 }],
      { duration: 220, easing: "ease-out", fill: "forwards" }
    );
  }, [animationKey]);

  const fetchMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setFetchError(false);

    const params = new URLSearchParams();
    if (searchParams.q) params.set("q", searchParams.q);
    // Omit default sort to keep URLs clean (matches Pagination behaviour)
    if (searchParams.sort && searchParams.sort !== "desconto")
      params.set("sort", searchParams.sort);
    if (searchParams.artista) params.set("artista", searchParams.artista);
    if (searchParams.precoMax) params.set("precoMax", searchParams.precoMax);
    params.set("page", String(nextPage));

    try {
      const res = await fetch(`/api/discos?${params.toString()}`);
      if (!res.ok) throw new Error("fetch failed");
      const data: { items: ProcessedDisco[]; totalPages: number } =
        await res.json();
      setItems((prev) => [...prev, ...data.items]);
      setNextPage((p) => p + 1);
      setHasMore(nextPage < data.totalPages);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, nextPage, searchParams]);

  // IntersectionObserver triggers fetch when sentinel enters viewport
  useEffect(() => {
    if (mode !== "infinite") return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) fetchMore(); },
      { rootMargin: "300px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [mode, fetchMore]);

  function toggleMode() {
    const next = mode === "paginate" ? "infinite" : "paginate";
    setMode(next);
    localStorage.setItem("garimpaScrollMode", next);
  }

  // #resultados is the pagination scroll target; scroll-mt clears the sticky
  // navbar (62px) + the sticky sort bar above the grid
  return (
    <div
      id="resultados"
      tabIndex={-1}
      className="scroll-mt-[190px] sm:scroll-mt-[150px] outline-none"
    >
      {/* Paginação / Scroll infinito toggle */}
      <div className="flex justify-end mb-3">
        <button
          onClick={toggleMode}
          className="inline-flex items-center gap-1.5 text-[11px] text-dust hover:text-parchment border border-groove hover:border-wax rounded-lg px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/20 cursor-pointer"
          aria-label={
            mode === "paginate"
              ? "Alternar para scroll infinito"
              : "Alternar para paginação"
          }
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span>Exibição: {mode === "paginate" ? "Paginação" : "Scroll"}</span>
        </button>
      </div>

      {/* Card grid — 4 cols desktop, 3 tablet, 2 mobile */}
      <ul
        ref={gridRef}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4"
      >
        {items.map((disco, index) => (
          <li key={disco.id}>
            <DiscoCard disco={disco} priority={index < 2} />
          </li>
        ))}
      </ul>

      {/* Infinite scroll: sentinel + status */}
      {mode === "infinite" && (
        <div ref={sentinelRef} className="mt-10 text-center min-h-[2rem]" aria-hidden="true">
          {loading && (
            <p className="text-dust text-sm animate-pulse">
              Carregando mais discos…
            </p>
          )}
          {fetchError && !loading && (
            <div className="flex items-center justify-center gap-3">
              <p className="text-parchment/60 text-sm">Erro ao carregar</p>
              <button
                onClick={fetchMore}
                className="text-xs text-gold hover:text-goldlit border border-groove hover:border-gold rounded-lg px-3 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/20"
              >
                Tentar novamente
              </button>
            </div>
          )}
          {!hasMore && !loading && !fetchError && items.length > 0 && (
            <p className="text-dust text-xs">Todos os discos foram carregados</p>
          )}
        </div>
      )}

      {/* Pagination (paginate mode only) */}
      {mode === "paginate" && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          searchParams={searchParams}
          basePath={basePath}
        />
      )}
    </div>
  );
}
