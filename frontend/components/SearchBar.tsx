"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useRef, useState, useEffect } from "react";
import SearchDropdown from "./SearchDropdown";

export default function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced value that drives the live-search dropdown
  const [liveQuery, setLiveQuery] = useState("");
  // True after user explicitly dismisses the dropdown (Escape / outside click / selection)
  const [dismissed, setDismissed] = useState(false);

  const showDropdown = !dismissed && liveQuery.length >= 2;

  function navigate(value: string) {
    setDismissed(true);
    const params = new URLSearchParams();
    const sort    = searchParams.get("sort");
    const artista = searchParams.get("artista");
    const precoMax = searchParams.get("precoMax");
    if (sort)     params.set("sort", sort);
    if (artista)  params.set("artista", artista);
    if (precoMax) params.set("precoMax", precoMax);
    if (value)    params.set("q", value);
    startTransition(() => {
      router.push(`/?${params.toString()}`);
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setDismissed(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setLiveQuery(val.trim()), 300);
  }

  function handleBuscar() {
    if (timerRef.current) clearTimeout(timerRef.current);
    navigate(inputRef.current?.value.trim() ?? "");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      if (timerRef.current) clearTimeout(timerRef.current);
      navigate((e.target as HTMLInputElement).value.trim());
    }
    if (e.key === "Escape") {
      setDismissed(true);
    }
  }

  // Dismiss dropdown when user clicks outside the search bar area
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDismissed(true);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative flex w-full">
      <form
        role="search"
        className="flex flex-1"
        onSubmit={(e) => { e.preventDefault(); handleBuscar(); }}
      >
        {/* Search icon / pending spinner */}
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10">
          {isPending ? (
            <svg className="w-4 h-4 text-gold animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path  className="opacity-75"  fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-dust" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          )}
        </div>

        <input
          ref={inputRef}
          id="site-search"
          type="search"
          autoComplete="off"
          aria-label="Buscar discos de vinil"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          placeholder="Busque por artista, álbum ou código..."
          defaultValue={searchParams.get("q") ?? ""}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={`flex-1 min-w-0 bg-sleeve border border-groove rounded-l-full pl-10 pr-4 py-2 text-sm text-cream placeholder-dust focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all ${
            isPending ? "opacity-60" : ""
          }`}
        />

        <button
          type="submit"
          className="shrink-0 bg-gold hover:bg-goldlit text-record font-bold text-sm px-3 sm:px-5 rounded-r-full transition-colors cursor-pointer"
          aria-label="Buscar"
        >
          Buscar
        </button>
      </form>

      {showDropdown && (
        <SearchDropdown
          query={liveQuery}
          onClose={() => setDismissed(true)}
        />
      )}
    </div>
  );
}
