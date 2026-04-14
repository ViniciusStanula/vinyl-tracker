"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useState, useEffect } from "react";

const SORT_OPTIONS = [
  { label: "Maior Desconto", value: "desconto" },
  { label: "Menor Preço", value: "menor-preco" },
  { label: "Maior Preço", value: "maior-preco" },
  { label: "Melhor Avaliação", value: "avaliados" },
  { label: "A-Z", value: "az" },
];

const PRECO_MAX = 1000;

export default function SortBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const current = searchParams.get("sort") ?? "desconto";
  const precoMaxParam = searchParams.get("precoMax");

  const [sliderValue, setSliderValue] = useState(
    precoMaxParam ? Math.min(Number(precoMaxParam), PRECO_MAX) : PRECO_MAX
  );

  // Sync slider when URL changes externally (back/forward nav)
  useEffect(() => {
    const v = searchParams.get("precoMax");
    setSliderValue(v ? Math.min(Number(v), PRECO_MAX) : PRECO_MAX);
  }, [searchParams]);

  function handleSort(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function commitPreco(value: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (value < PRECO_MAX) {
      params.set("precoMax", String(value));
    } else {
      params.delete("precoMax");
    }
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div
      className={`bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 transition-opacity ${
        isPending ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-4 flex-wrap">
        {/* Price range filter */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-zinc-400 shrink-0">
            Preço:
          </span>
          <input
            type="range"
            min={0}
            max={PRECO_MAX}
            step={50}
            value={sliderValue}
            onChange={(e) => setSliderValue(Number(e.target.value))}
            onPointerUp={(e) =>
              commitPreco(Number((e.target as HTMLInputElement).value))
            }
            className="w-32 sm:w-44 accent-amber-500 cursor-pointer"
          />
          <span className="text-xs text-zinc-300 w-24 shrink-0">
            Até{" "}
            {sliderValue >= PRECO_MAX
              ? "R$ 1.000"
              : `R$ ${sliderValue.toLocaleString("pt-BR")}`}
          </span>
        </div>

        {/* Vertical divider */}
        <div className="hidden sm:block h-5 w-px bg-zinc-700 shrink-0" />

        {/* Sort dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-sm select-none" aria-hidden>
            ↕
          </span>
          <select
            value={current}
            onChange={(e) => handleSort(e.target.value)}
            className="bg-zinc-800 text-zinc-100 text-sm border border-zinc-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer transition-colors"
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
  );
}
