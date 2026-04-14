"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useRef } from "react";

export default function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const value = e.target.value.trim();
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    }, 300);
  }

  return (
    <div className="relative w-full">
      {isPending ? (
        /* Spinner while navigation is pending */
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500 animate-spin pointer-events-none"
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
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none"
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
      <input
        type="search"
        placeholder="Buscar título ou artista..."
        defaultValue={searchParams.get("q") ?? ""}
        onChange={handleChange}
        className={`w-full bg-zinc-800 border border-zinc-700 rounded-full pl-9 pr-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors ${
          isPending ? "opacity-60" : ""
        }`}
      />
    </div>
  );
}
