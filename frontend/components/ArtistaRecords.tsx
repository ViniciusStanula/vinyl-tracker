"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import DiscoCard from "@/components/DiscoCard";
import type { ProcessedDisco } from "@/lib/queryDiscos";

// Mirrors lib/queryDiscos.ts buildOrderBy + SortBar.tsx options. Filtering runs
// client-side over the artist's full catalog (passed from the ISR-cached page),
// so the route stays static — no server searchParams.
const SORT_OPTIONS = [
  { label: "Maior Desconto",   value: "desconto"    },
  { label: "Menor Preço",      value: "menor-preco" },
  { label: "Maior Preço",      value: "maior-preco" },
  { label: "Melhor Avaliação", value: "avaliados"   },
  { label: "A–Z",              value: "az"          },
] as const;

const PRICE_CHIPS = [
  { label: "R$50",  value: 50   },
  { label: "R$100", value: 100  },
  { label: "R$200", value: 200  },
  { label: "R$500", value: 500  },
  { label: "Todos", value: null },
] as const;

const PAGE_SIZE = 24;

function comparator(sort: string): (a: ProcessedDisco, b: ProcessedDisco) => number {
  switch (sort) {
    case "menor-preco": return (a, b) => a.precoAtual - b.precoAtual;
    case "maior-preco": return (a, b) => b.precoAtual - a.precoAtual;
    case "avaliados":   return (a, b) => (b.rating ?? 0) - (a.rating ?? 0);
    case "az":          return (a, b) => a.titulo.localeCompare(b.titulo, "pt-BR");
    case "desconto":
    default:            return (a, b) => b.desconto - a.desconto || (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
  }
}

export default function ArtistaRecords({
  items,
  slug,
  basePath = "/artista",
}: {
  items: ProcessedDisco[];
  slug: string;
  /** Route prefix for the no-JS fallback link — "/artista" (default) or "/estilo". */
  basePath?: string;
}) {
  const [sort, setSort] = useState<string>("desconto");
  const [precoMax, setPrecoMax] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const base = precoMax !== null ? items.filter((i) => i.precoAtual <= precoMax) : items;
    return [...base].sort(comparator(sort));
  }, [items, sort, precoMax]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasFilters = sort !== "desconto" || precoMax !== null;

  function changeSort(value: string) {
    setSort(value);
    setPage(1);
  }
  function changePrice(value: number | null) {
    setPrecoMax(value);
    setPage(1);
  }

  return (
    <>
      <div className="sticky top-[62px] z-40 mb-3 bg-record/95 backdrop-blur-md -mx-4 px-4 pt-2 pb-2">
        <div className="bg-sleeve border border-groove rounded-xl px-5 py-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5 sm:flex-wrap">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[11px] font-bold text-dust uppercase tracking-widest shrink-0">
                Filtrar por Preço
              </span>
              {PRICE_CHIPS.map((chip) => {
                const isActive = chip.value === precoMax;
                return (
                  <button
                    key={chip.label}
                    onClick={() => changePrice(chip.value)}
                    aria-pressed={isActive}
                    className={`text-xs px-3 py-2.5 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/20 shrink-0 ${
                      isActive
                        ? "bg-gold text-record border-gold font-bold"
                        : "bg-groove text-parchment border-wax/60 hover:border-wax hover:text-cream"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            <div className="hidden sm:block h-5 w-px bg-wax/60 shrink-0" />

            <div className="flex items-center gap-2.5">
              <label
                htmlFor="artista-sort"
                className="text-[11px] font-bold text-dust uppercase tracking-widest shrink-0 cursor-pointer"
              >
                Ordenar
              </label>
              <select
                id="artista-sort"
                value={sort}
                onChange={(e) => changeSort(e.target.value)}
                className="bg-groove text-cream text-sm border border-wax/60 rounded-lg px-3 py-1.5 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 cursor-pointer transition-colors"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {pageItems.length > 0 ? (
        <>
          <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {pageItems.map((disco, index) => (
              <li key={disco.id}>
                <DiscoCard disco={disco} priority={index < 4} />
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <nav aria-label="Paginação" className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-4 py-2 rounded-lg border border-wax/60 bg-groove text-parchment text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:text-cream hover:enabled:border-wax transition-colors"
              >
                Anterior
              </button>
              <span className="text-dust text-sm tabular-nums px-2">
                {safePage} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-4 py-2 rounded-lg border border-wax/60 bg-groove text-parchment text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:text-cream hover:enabled:border-wax transition-colors"
              >
                Próximo
              </button>
            </nav>
          )}
        </>
      ) : (
        <section aria-label="Sem resultados" className="text-center py-24 text-dust">
          <div className="inline-block mb-5 opacity-40">
            <svg viewBox="0 0 64 64" fill="none" className="w-16 h-16 mx-auto" aria-hidden="true">
              <circle cx="32" cy="32" r="30" className="fill-gold" opacity="0.3" />
              <circle cx="32" cy="32" r="20" className="fill-record" opacity="0.8" />
              <circle cx="32" cy="32" r="5"  className="fill-gold" opacity="0.4" />
              <circle cx="32" cy="32" r="2"  className="fill-record" />
            </svg>
          </div>
          <p className="font-display text-parchment text-lg font-semibold mb-2">
            Nenhum disco encontrado
          </p>
          <p className="text-dust text-sm mb-4">Tente ajustar os filtros.</p>
          {hasFilters && (
            <button
              onClick={() => { changeSort("desconto"); changePrice(null); }}
              className="inline-flex items-center gap-2 bg-groove hover:bg-wax text-parchment text-sm px-5 py-2 rounded-full transition-colors border border-wax/60"
            >
              Limpar filtros
            </button>
          )}
          {/* Fallback link to the clean URL for crawlers/no-JS */}
          <Link href={`${basePath}/${slug}`} className="sr-only">Ver todos os discos</Link>
        </section>
      )}
    </>
  );
}
