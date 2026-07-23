"use client";

import { useState, useEffect } from "react";
import HubFilterInput from "@/components/hub/HubFilterInput";

/* Filters the artist index without holding the list in JavaScript.
   /artistas renders 11,725 server-rendered cards; passing that array to a
   client component would duplicate the whole catalogue into the RSC payload.
   Instead the server stamps each card with a folded `data-nome`, and this
   component injects one CSS rule that hides non-matching cards — the browser
   does the filtering natively, so a keystroke costs one style recalculation
   rather than 11,725 React updates.

   `:has()` hides letter sections that end up empty. Anything the CSS can't
   express (the visible count) is a single querySelectorAll. */

/** Must match the server-side folding in app/artistas/page.tsx. */
function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Escapes a value for use inside a CSS attribute selector's quoted string. */
function cssEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const STYLE_ID = "artistas-filter-style";

export default function ArtistasFilter({ total }: { total: number }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<number | null>(null);

  /* Runs in the event handler, not an effect: the index is static server HTML
     that React never reconciles, so there's nothing to synchronise after
     render — and doing it here keeps one keystroke to one style recalc. */
  function handleChange(next: string) {
    setQuery(next);

    const q = fold(next.trim());
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;

    if (!q) {
      style?.remove();
      setMatches(null);
      return;
    }

    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    const sel = `[data-nome*="${cssEscape(q)}"]`;
    style.textContent =
      `[data-artista-item]:not(${sel}) { display: none; }\n` +
      `[data-letra-section]:not(:has(${sel})) { display: none; }`;

    setMatches(document.querySelectorAll(`[data-artista-item]${sel}`).length);
  }

  // Drop the injected rule if the component unmounts mid-filter.
  useEffect(() => () => document.getElementById(STYLE_ID)?.remove(), []);

  return (
    <>
      <HubFilterInput
        id="artista-filter"
        label="Filtrar artistas por nome"
        placeholder="Filtrar por artista…"
        value={query}
        onChange={handleChange}
      />
      {matches !== null && (
        <p
          aria-live="polite"
          className="font-mono mt-3 text-[11px] font-medium uppercase tracking-[0.14em] tabular-nums text-parchment"
        >
          {matches === 0
            ? `Nenhum artista encontrado — são ${total.toLocaleString("pt-BR")} no índice`
            : `${matches.toLocaleString("pt-BR")} ${matches === 1 ? "artista" : "artistas"}`}
        </p>
      )}
    </>
  );
}
