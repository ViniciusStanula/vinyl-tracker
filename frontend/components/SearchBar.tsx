"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useRef } from "react";

export default function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function navigate(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("q", value);
    } else {
      params.delete("q");
    }
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      navigate(e.target.value.trim());
    }, 300);
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
  }

  return (
    <div className="relative flex w-full">
      {/* Search icon / spinner */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
        {isPending ? (
          <svg
            className="w-4 h-4 text-amber-500 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4 text-zinc-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
        )}
      </div>

      <input
        ref={inputRef}
        type="search"
        placeholder="Busque por artista, álbum ou código..."
        defaultValue={searchParams.get("q") ?? ""}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={`flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-l-full pl-9 pr-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 transition-all ${
          isPending ? "opacity-60" : ""
        }`}
      />

      <button
        onClick={handleBuscar}
        className="shrink-0 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm px-4 rounded-r-full transition-colors cursor-pointer"
        aria-label="Buscar"
      >
        Buscar
      </button>
    </div>
  );
}
