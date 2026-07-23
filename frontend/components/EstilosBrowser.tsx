"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { HubCard, HubHeader, HubTile, SectionRule } from "@/components/hub/HubUI";
import HubFilterInput from "@/components/hub/HubFilterInput";

export type EstiloItem = {
  slug: string;
  nome: string;
  count: number;
};

/* Curated clusters. Hand-picked rather than derived: the point is editorial
   grouping ("where do I start?"), which no count-based heuristic gives you.
   Slugs are matched against the live list, so a tag that disappears from the
   catalogue silently drops out of its cluster instead of 404-ing. */
const CLUSTERS = [
  {
    title: "Brasil",
    subtitle: "Curadoria especial local",
    slugs: ["bossa-nova", "mpb", "samba", "tropicalia", "brazilian-rock", "forro"],
  },
  {
    title: "Os Clássicos",
    subtitle: "Gêneros fundamentais",
    slugs: ["pop", "classic-rock", "folk", "blues", "classical", "reggae"],
  },
  {
    title: "Underground",
    subtitle: "Nichos e subculturas",
    slugs: ["heavy-metal", "punk", "indie-pop", "synthpop", "death-metal", "industrial"],
  },
] as const;

const FEATURED_COUNT = 5;

/** Strips accents so "tropicalia" matches "Tropicália". */
function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default function EstilosBrowser({ estilos }: { estilos: EstiloItem[] }) {
  const [query, setQuery] = useState("");

  const bySlug = useMemo(
    () => new Map(estilos.map((e) => [e.slug, e])),
    [estilos]
  );

  const featured = useMemo(
    () => [...estilos].sort((a, b) => b.count - a.count).slice(0, FEATURED_COUNT),
    [estilos]
  );

  // Alphabetical index, grouped by first letter. Anything not A–Z (numbers,
  // symbols) collects under "#" so no style falls out of the index.
  const letters = useMemo(() => {
    const groups = new Map<string, EstiloItem[]>();
    for (const e of [...estilos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))) {
      const first = fold(e.nome).charAt(0).toUpperCase();
      const key = /[A-Z]/.test(first) ? first : "#";
      const bucket = groups.get(key);
      if (bucket) bucket.push(e);
      else groups.set(key, [e]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [estilos]);

  const results = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return null;
    return estilos.filter((e) => fold(e.nome).includes(q));
  }, [estilos, query]);

  const filtering = results !== null;

  return (
    <>
      <HubHeader
        eyebrow="Por gênero"
        title="Explorar Estilos"
        description={`${estilos.length.toLocaleString("pt-BR")} estilos de discos de vinil monitorados na Amazon Brasil, com histórico de preços de 12 meses.`}
        aside={
          <HubFilterInput
            id="estilo-filter"
            label="Filtrar estilos por nome"
            placeholder="Filtrar por gênero…"
            value={query}
            onChange={setQuery}
          />
        }
      />

      {/* Filter status for screen readers — the visible count lives in the
          results heading below. */}
      <p aria-live="polite" className="sr-only">
        {filtering ? `${results.length} estilos encontrados` : ""}
      </p>

      {filtering ? (
        /* ── Filtered results ───────────────────────────────────── */
        <section aria-label="Resultados do filtro" className="mb-10 sm:mb-14">
          {results.length === 0 ? (
            <div className="rounded-xl border border-groove bg-sleeve px-6 py-16 text-center">
              <p className="font-display text-parchment text-lg font-semibold mb-2">
                Nenhum estilo encontrado
              </p>
              <p className="text-dust text-sm">
                Tente outro termo — são {estilos.length.toLocaleString("pt-BR")} estilos no índice.
              </p>
            </div>
          ) : (
            <>
              <p className="font-mono mb-6 text-[11px] font-medium uppercase tracking-[0.14em] tabular-nums text-parchment">
                {results.length.toLocaleString("pt-BR")}{" "}
                {results.length === 1 ? "estilo encontrado" : "estilos encontrados"}
              </p>
              <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {results.map((e) => (
                  <li key={e.slug}>
                    <HubCard href={`/estilo/${e.slug}`} label={e.nome} count={e.count} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : (
        <>
          {/* ── Featured mosaic ──────────────────────────────────── */}
          {featured.length >= FEATURED_COUNT && (
            <section aria-label="Estilos mais populares" className="mb-10 sm:mb-14">
              <div className="grid gap-4 lg:grid-cols-2">
                <HubTile href={`/estilo/${featured[0].slug}`} label={featured[0].nome} count={featured[0].count} badge="Mais popular" featured />
                <div className="grid grid-cols-2 gap-4">
                  {featured.slice(1).map((e) => (
                    <HubTile key={e.slug} href={`/estilo/${e.slug}`} label={e.nome} count={e.count} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ── Curated clusters ─────────────────────────────────── */}
          {CLUSTERS.map(({ title, subtitle, slugs }) => {
            const items = slugs
              .map((s) => bySlug.get(s))
              .filter((e): e is EstiloItem => e !== undefined);
            if (items.length === 0) return null;
            return (
              <section key={title} aria-label={title} className="mb-10 sm:mb-14">
                <SectionRule title={title} subtitle={subtitle} />
                <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {items.map((e) => (
                    <li key={e.slug}>
                      <HubCard href={`/estilo/${e.slug}`} label={e.nome} count={e.count} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {/* ── Full A–Z index ───────────────────────────────────── */}
          <section aria-labelledby="indice-heading">
            <div className="mb-6 flex items-end justify-between gap-4 flex-wrap border-b border-groove pb-3">
              <h2
                id="indice-heading"
                className="font-display text-2xl sm:text-3xl font-black text-cream leading-tight"
              >
                Índice completo
              </h2>
              <nav aria-label="Ir para letra" className="flex flex-wrap gap-1">
                {letters.map(([letter]) => (
                  <a
                    key={letter}
                    href={`#letra-${letter}`}
                    className="font-mono flex h-8 w-8 items-center justify-center rounded border border-groove text-[11px] font-medium text-parchment hover:border-gold hover:text-cream transition-colors"
                  >
                    {letter}
                  </a>
                ))}
              </nav>
            </div>

            {letters.map(([letter, items]) => (
              <div key={letter} id={`letra-${letter}`} className="mb-8 scroll-mt-24">
                <h3 className="font-mono mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
                  {letter}
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6">
                  {items.map((e) => (
                    <li key={e.slug} className="border-b border-groove/60">
                      <Link
                        href={`/estilo/${e.slug}`}
                        className="group flex items-baseline justify-between gap-3 py-2.5 transition-colors"
                      >
                        <span className="text-parchment group-hover:text-cream text-sm truncate transition-colors">
                          {e.nome}
                        </span>
                        <span className="font-mono shrink-0 text-[11px] tabular-nums text-dust group-hover:text-gold transition-colors">
                          {e.count.toLocaleString("pt-BR")}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}
    </>
  );
}
