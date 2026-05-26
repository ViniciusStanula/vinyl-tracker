"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import AlbumCard, { type AlbumCardProps } from "./AlbumCard";

const CARD_WIDTH = { preview: 176, featured: 224 } as const;
const CARD_CLASS = { preview: "w-44", featured: "w-56" } as const;

type CarouselSize = keyof typeof CARD_WIDTH;

interface AlbumCarouselProps {
  albums: AlbumCardProps[];
  size?: CarouselSize;
}

export default function AlbumCarousel({ albums, size = "preview" }: AlbumCarouselProps) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0 });
  const [dragging, setDragging] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const checkEdges = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    checkEdges();
    el.addEventListener("scroll", checkEdges, { passive: true });
    return () => el.removeEventListener("scroll", checkEdges);
  }, [checkEdges]);

  const onMouseDown = (e: React.MouseEvent) => {
    drag.current = {
      active: true,
      startX: e.pageX - (ref.current?.offsetLeft ?? 0),
      scrollLeft: ref.current?.scrollLeft ?? 0,
    };
    setDragging(true);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag.current.active) return;
    e.preventDefault();
    const x = e.pageX - (ref.current?.offsetLeft ?? 0);
    const walk = x - drag.current.startX;
    if (ref.current) ref.current.scrollLeft = drag.current.scrollLeft - walk;
  };

  const stopDrag = () => {
    drag.current.active = false;
    setDragging(false);
  };

  const scrollStep = CARD_WIDTH[size] * 3;
  const scrollBy = (dir: "left" | "right") => {
    ref.current?.scrollBy({ left: dir === "right" ? scrollStep : -scrollStep, behavior: "smooth" });
  };

  return (
    <div className="space-y-3">
      <div className="relative -mx-4 sm:mx-0">
        {/* Left fade — only when scrolled */}
        <div
          className={`absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-record to-transparent z-10 pointer-events-none transition-opacity duration-200 ${atStart ? "opacity-0" : "opacity-100"}`}
        />
        {/* Right fade — hide when at end */}
        <div
          className={`absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-record to-transparent z-10 pointer-events-none transition-opacity duration-200 ${atEnd ? "opacity-0" : "opacity-100"}`}
        />

        <div
          ref={ref}
          role="region"
          aria-label="Carrossel de álbuns"
          className={`flex gap-4 overflow-x-auto pb-3 no-scrollbar touch-pan-x px-4 sm:px-0 ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
        >
          {albums.map((album) => (
            <div key={album.mb_rgid} className={`flex-none ${CARD_CLASS[size]}`}>
              <AlbumCard {...album} />
            </div>
          ))}
        </div>
      </div>

      {/* Prev / Next controls */}
      <div className="flex justify-end gap-2 pr-0.5">
        <button
          onClick={() => scrollBy("left")}
          aria-label="Discos anteriores"
          disabled={atStart}
          className="flex items-center justify-center w-8 h-8 rounded-full border border-groove bg-sleeve text-dust hover:text-cream hover:border-patina transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M8 1L3 6l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={() => scrollBy("right")}
          aria-label="Próximos discos"
          disabled={atEnd}
          className="flex items-center justify-center w-8 h-8 rounded-full border border-groove bg-sleeve text-dust hover:text-cream hover:border-patina transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M4 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
