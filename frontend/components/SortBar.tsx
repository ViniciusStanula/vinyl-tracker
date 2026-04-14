"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

const SORT_OPTIONS = [
  { label: "Melhores Descontos", value: "desconto" },
  { label: "Menor Preço", value: "menor-preco" },
  { label: "Maior Preço", value: "maior-preco" },
  { label: "Melhores Avaliados", value: "avaliados" },
  { label: "A-Z", value: "az" },
];

export default function SortBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const current = searchParams.get("sort") ?? "desconto";

  function handleSort(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    params.delete("page"); // reset to page 1 when sort changes
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mr-2">
        Ordenar por
      </span>
      {SORT_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => handleSort(opt.value)}
          className={`text-xs px-3 py-1.5 rounded-full transition-all cursor-pointer ${
            current === opt.value
              ? "bg-amber-500 text-zinc-950 font-semibold"
              : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          } ${isPending ? "opacity-50 cursor-wait" : ""}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
