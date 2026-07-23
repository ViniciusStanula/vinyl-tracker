"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DiscoCard from "./DiscoCard";
import type { ProcessedDisco } from "@/lib/queryDiscos";

const SCROLL_AMOUNT = 640;

export default function ArtistasCarousel({ items }: { items: ProcessedDisco[] }) {
  const ref                       = useRef<HTMLUListElement>(null);
  const [canLeft,  setCanLeft ]   = useState(false);
  const [canRight, setCanRight]   = useState(false);

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    el.addEventListener("scroll", sync, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", sync);
    };
  }, [sync]);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="carousel-heading" className="mb-10 sm:mb-14">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <span className="font-mono text-gold text-[11px] font-medium uppercase tracking-[0.18em] block mb-2">
            Curadoria do dia
          </span>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 id="carousel-heading" className="font-display text-2xl sm:text-3xl font-black text-cream leading-tight">
              Discos em Destaque
            </h2>
            <Link
              href="/artistas-mais-ouvidos"
              className="text-parchment hover:text-gold text-xs transition-colors"
            >
              Ver artistas mais ouvidos →
            </Link>
          </div>
          <div className="mt-2 h-0.5 w-10 bg-gold rounded-full" aria-hidden="true" />
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => ref.current?.scrollBy({ left: -SCROLL_AMOUNT, behavior: "smooth" })}
            disabled={!canLeft}
            className="w-11 h-11 flex items-center justify-center rounded-full border border-groove hover:border-wax text-cream text-lg disabled:opacity-20 disabled:cursor-default transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            aria-label="Rolar para esquerda"
          >
            ‹
          </button>
          <button
            onClick={() => ref.current?.scrollBy({ left: SCROLL_AMOUNT, behavior: "smooth" })}
            disabled={!canRight}
            className="w-11 h-11 flex items-center justify-center rounded-full border border-groove hover:border-wax text-cream text-lg disabled:opacity-20 disabled:cursor-default transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            aria-label="Rolar para direita"
          >
            ›
          </button>
        </div>
      </div>

      <ul
        ref={ref}
        className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 no-scrollbar"
      >
        {items.map((disco, i) => (
          <li key={disco.id} className="snap-start shrink-0 w-44 sm:w-52">
            <DiscoCard disco={disco} priority={i < 3} />
          </li>
        ))}
      </ul>
    </section>
  );
}
