"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useState, useEffect } from "react";

const SORT_OPTIONS = [
  { label: "Melhores Ofertas",  value: "deals"       },
  { label: "Maior Desconto",    value: "desconto"     },
  { label: "Menor Preço",       value: "menor-preco"  },
  { label: "Maior Preço",       value: "maior-preco"  },
  { label: "Melhor Avaliação",  value: "avaliados"    },
  { label: "A–Z",               value: "az"           },
];

const PRECO_MAX = 1000;

export default function SortBar() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const current      = searchParams.get("sort") ?? "desconto";
  const precoMaxParam = searchParams.get("precoMax");

  const [sliderValue, setSliderValue] = useState(
    precoMaxParam ? Math.min(Number(precoMaxParam), PRECO_MAX) : PRECO_MAX
  );

  useEffect(() => {
    const v = searchParams.get("precoMax");
    setSliderValue(v ? Math.min(Number(v), PRECO_MAX) : PRECO_MAX);
  }, [searchParams]);

  function handleSort(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function commitPreco(value: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (value < PRECO_MAX) {
      params.set("precoMax", String(value));
    } else {
      params.delete("precoMax");
    }
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div
      className={`bg-sleeve border border-groove rounded-xl px-5 py-3.5 transition-opacity ${
        isPending ? "opacity-55" : ""
      }`}
    >
      <div className="flex items-center gap-5 flex-wrap">

        {/* ── Price range ── */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-dust uppercase tracking-widest shrink-0">
            Preço
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
            className="w-32 sm:w-44 accent-gold cursor-pointer"
          />
          <span className="text-sm text-cream font-semibold w-[6.5rem] shrink-0 tabular-nums">
            {sliderValue >= PRECO_MAX
              ? "Até R$ 1.000"
              : `Até R$ ${sliderValue.toLocaleString("pt-BR")}`}
          </span>
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-5 w-px bg-wax/60 shrink-0" />

        {/* ── Sort ── */}
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-bold text-dust uppercase tracking-widest shrink-0">
            Ordenar
          </span>
          <select
            value={current}
            onChange={(e) => handleSort(e.target.value)}
            className="bg-groove text-cream text-sm border border-wax/60 rounded-lg px-3 py-1.5 focus:outline-none focus:border-gold cursor-pointer transition-colors"
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
