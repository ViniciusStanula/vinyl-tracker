"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

const SORT_OPTIONS = [
  { label: "Maior Desconto",    value: "desconto"     },
  { label: "Menor Preço",       value: "menor-preco"  },
  { label: "Maior Preço",       value: "maior-preco"  },
  { label: "Melhor Avaliação",  value: "avaliados"    },
  { label: "A–Z",               value: "az"           },
];

const PRICE_CHIPS = [
  { label: "R$50",   value: 50   },
  { label: "R$100",  value: 100  },
  { label: "R$200",  value: 200  },
  { label: "R$500",  value: 500  },
  { label: "Todos",  value: null },
];

export default function SortBar() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const current      = searchParams.get("sort") ?? "desconto";
  const precoMaxParam = searchParams.get("precoMax");
  const activePrice  = precoMaxParam ? Number(precoMaxParam) : null;

  function handleSort(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function handlePrice(value: number | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value !== null) {
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5 sm:flex-wrap">

        {/* ── Price chips ── */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-bold text-dust uppercase tracking-widest shrink-0">
            Preço
          </span>
          {PRICE_CHIPS.map((chip) => {
            const isActive = chip.value === activePrice;
            return (
              <button
                key={chip.label}
                onClick={() => handlePrice(chip.value)}
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

        {/* Divider */}
        <div className="hidden sm:block h-5 w-px bg-wax/60 shrink-0" />

        {/* ── Sort ── */}
        <div className="flex items-center gap-2.5">
          <label
            htmlFor="sort-select"
            className="text-[11px] font-bold text-dust uppercase tracking-widest shrink-0 cursor-pointer"
          >
            Ordenar
          </label>
          <select
            id="sort-select"
            value={current}
            onChange={(e) => handleSort(e.target.value)}
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
  );
}
