"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { slugifyArtist } from "@/lib/slugify";
import type { SearchSuggestion } from "@/app/api/search/route";

type Props = {
  query: string;
  onClose: () => void;
};

export default function SearchDropdown({ query, onClose }: Props) {
  const [results, setResults] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const prevQueryRef = useRef("");

  useEffect(() => {
    const q = query.trim();

    if (q.length < 2) {
      setResults([]);
      setFetched(false);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }

    // Skip re-fetch for identical query
    if (q === prevQueryRef.current) return;
    prevQueryRef.current = q;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then(r => r.json())
      .then((data: SearchSuggestion[]) => {
        setResults(data);
        setFetched(true);
        setLoading(false);
      })
      .catch(err => {
        if (err.name !== "AbortError") {
          setResults([]);
          setFetched(true);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [query]);

  if (!loading && !fetched) return null;

  return (
    <div
      role="listbox"
      aria-label="Sugestões de busca"
      className="absolute top-full left-0 right-0 mt-1.5 bg-sleeve border border-groove rounded-xl shadow-2xl overflow-hidden z-50"
    >
      {/* Loading skeleton — fixed height prevents layout shift */}
      {loading && results.length === 0 && (
        <div className="flex items-center gap-2.5 px-4 py-3 text-dust text-sm">
          <svg className="w-3.5 h-3.5 animate-spin shrink-0 text-gold" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Buscando...
        </div>
      )}

      {/* Empty state */}
      {!loading && fetched && results.length === 0 && (
        <div className="px-4 py-3 text-dust text-sm">
          Sem resultados para{" "}
          <span className="text-cream">&ldquo;{query}&rdquo;</span>
        </div>
      )}

      {/* Result rows */}
      {results.map((r, idx) => (
        <Link
          key={r.id}
          role="option"
          href={`/artista/${slugifyArtist(r.artista)}`}
          onClick={onClose}
          className={`flex items-center gap-3 px-4 py-2.5 hover:bg-groove transition-colors${
            idx < results.length - 1 ? " border-b border-groove/40" : ""
          }`}
        >
          {r.imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={r.imgUrl}
              alt=""
              aria-hidden
              width={36}
              height={36}
              className="w-9 h-9 rounded object-cover shrink-0 bg-wax"
            />
          ) : (
            <div className="w-9 h-9 rounded bg-wax shrink-0" aria-hidden />
          )}

          <div className="min-w-0 flex-1">
            <p className="text-cream text-sm font-medium truncate">{r.titulo}</p>
            <p className="text-dust text-xs truncate">{r.artista}</p>
          </div>

          {r.preco !== null && (
            <span className="text-gold text-sm font-semibold shrink-0 tabular-nums">
              R${" "}
              {r.preco.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          )}
        </Link>
      ))}

      {/* "See all results" footer when at the 8-result cap */}
      {results.length >= 8 && (
        <Link
          href={`/?q=${encodeURIComponent(query)}`}
          onClick={onClose}
          className="flex items-center justify-center gap-1 px-4 py-2.5 text-dust text-xs hover:text-cream hover:bg-groove transition-colors border-t border-groove/50"
        >
          Ver todos os resultados para
          <span className="text-gold ml-1">&ldquo;{query}&rdquo;</span>
        </Link>
      )}
    </div>
  );
}
