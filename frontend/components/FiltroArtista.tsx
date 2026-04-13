"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

interface Props {
  artistas: string[];
}

export default function FiltroArtista({ artistas }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const current = searchParams.get("artista") ?? "";

  function select(artista: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (current === artista) {
      params.delete("artista");
    } else {
      params.set("artista", artista);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function clearFilter() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("artista");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <button
        onClick={clearFilter}
        className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
          !current
            ? "bg-amber-500 text-zinc-950 font-semibold"
            : "bg-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700"
        }`}
      >
        Todos
      </button>

      {artistas.map((artista) => (
        <button
          key={artista}
          onClick={() => select(artista)}
          className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
            current === artista
              ? "bg-amber-500 text-zinc-950 font-semibold"
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700"
          }`}
        >
          {artista}
        </button>
      ))}
    </div>
  );
}
