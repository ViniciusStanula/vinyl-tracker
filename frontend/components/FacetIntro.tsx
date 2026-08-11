import Link from "next/link";
import { getEstiloSlugSet, getEstiloDisplayName } from "@/lib/db/estilo";
import { decadaLabel } from "@/lib/decadas";
import type { FacetStats } from "@/lib/db/facetStats";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** "a, b e c" — Portuguese list, serial "e" instead of a trailing comma. */
function listaPt(nodes: React.ReactNode[]): React.ReactNode[] {
  return nodes.flatMap((node, i) => {
    if (i === 0) return [node];
    return [i === nodes.length - 1 ? " e " : ", ", node];
  });
}

const linkArtista = (a: FacetStats["topArtistas"][number]) => (
  <Link key={a.slug} href={`/artista/${a.slug}`} className="text-gold hover:underline">
    {a.artista}
  </Link>
);

const artistaComContagem = (a: FacetStats["topArtistas"][number]) => (
  <span key={a.slug}>
    {linkArtista(a)} ({a.count.toLocaleString("pt-BR")})
  </span>
);

/** Ranked artists as a sentence rather than a labelled list — and a tie at the
 *  top reads as a shared lead, not as an arbitrary first place. */
function fraseArtistas(top: FacetStats["topArtistas"]) {
  const [a1, a2, ...resto] = top;
  const discos = (n: number) => (n === 1 ? "1 disco" : `${n.toLocaleString("pt-BR")} discos`);

  // On a small facet the counts are 3, 2, 2, 2, 2 — a ranking made of noise.
  // Name the artists and drop the numbers rather than dress it up as a chart.
  if (a1.count < 4) {
    return <>Entre os artistas: {listaPt(top.map(linkArtista))}.</>;
  }

  if (a1.count === a2.count) {
    return (
      <>
        {linkArtista(a1)} e {linkArtista(a2)} encabeçam com {discos(a1.count)} cada
        {resto.length > 0 ? <>; na sequência, {listaPt(resto.map(artistaComContagem))}</> : null}.
      </>
    );
  }

  return (
    <>
      {linkArtista(a1)} encabeça com {discos(a1.count)}, à frente de{" "}
      {listaPt([a2, ...resto].map(artistaComContagem))}.
    </>
  );
}

/**
 * The facet listing's own numbers, in prose, above the grid.
 *
 * Every facet page used to be an H1, a record count and a grid — which meant
 * that with the grid stripped out, /decada/1970 and /decada/1980 differed by
 * two numbers and nothing else. These sentences are computed per facet from
 * the whole listing (see getFacetStats), so each page states facts no other
 * facet page states, and they double as internal links into the artist and
 * style hubs.
 */
export default async function FacetIntro({
  stats,
  sujeito,
  mostrarAno = true,
  className = "",
}: {
  stats: FacetStats;
  /** Subject of the opening sentence, already inflected by the page, e.g.
   *  "Os 412 discos de artistas do Japão". */
  sujeito: string;
  /** Off on /decada, where "vão de 1970 a 1979" restates the page title. */
  mostrarAno?: boolean;
  className?: string;
}) {
  const estiloSlugs = await getEstiloSlugSet().catch(() => new Set<string>());

  const { anoMin, anoMax, precoMin, precoMediana, precoMax, emOferta, decadaTop, topArtistas, topEstilos } = stats;

  const temAno = mostrarAno && anoMin !== null && anoMax !== null && anoMin < anoMax;
  const temPreco = precoMin !== null && precoMediana !== null && precoMax !== null;
  const estilosLinkaveis = topEstilos.filter((e) => estiloSlugs.has(e.slug));

  // A lone sentence reads as filler; the block only earns its place when the
  // facet has enough enrichment behind it to say two things or more.
  const frases = [temAno, temPreco, topArtistas.length >= 3].filter(Boolean).length;
  if (frases < 2) return null;

  return (
    <section
      aria-labelledby="facet-intro-heading"
      className={`bg-sleeve border border-groove rounded-xl px-5 py-4 ${className}`}
    >
      <h2 id="facet-intro-heading" className="sr-only">
        Resumo do catálogo
      </h2>
      <p className="text-parchment text-sm leading-relaxed">
        {temAno ? (
          <>
            {sujeito} vão de {anoMin} a {anoMax}
            {decadaTop && decadaTop.count > 1 ? (
              <>
                , com o maior bloco nos {decadaLabel(decadaTop.decada)} ({decadaTop.count.toLocaleString("pt-BR")}{" "}
                {decadaTop.count === 1 ? "título" : "títulos"})
              </>
            ) : null}
            .{" "}
            {temPreco ? (
              <>
                Hoje custam de {brl(precoMin)} a {brl(precoMax)}, mediana de {brl(precoMediana)}
                {emOferta > 0 ? (
                  <>
                    {" "}
                    — {emOferta.toLocaleString("pt-BR")}{" "}
                    {emOferta === 1 ? "está" : "estão"} abaixo da própria média de 30 dias
                  </>
                ) : null}
                .{" "}
              </>
            ) : null}
          </>
        ) : temPreco ? (
          // Without the year sentence the subject has nothing to attach to, so
          // it opens the price sentence instead of standing on its own.
          <>
            {sujeito} custam hoje de {brl(precoMin)} a {brl(precoMax)}, mediana de {brl(precoMediana)}
            {emOferta > 0 ? (
              <>
                {" "}
                — {emOferta.toLocaleString("pt-BR")} {emOferta === 1 ? "está" : "estão"} abaixo da própria média de 30
                dias
              </>
            ) : null}
            .{" "}
          </>
        ) : (
          <>{sujeito}. </>
        )}
        {topArtistas.length >= 3 ? <>{fraseArtistas(topArtistas)} </> : null}
        {estilosLinkaveis.length >= 2 ? (
          <>
            Etiquetas mais comuns:{" "}
            {listaPt(
              estilosLinkaveis.map((e) => (
                <span key={e.slug}>
                  <Link href={`/estilo/${e.slug}`} className="text-gold hover:underline">
                    {getEstiloDisplayName(e.tag)}
                  </Link>{" "}
                  ({e.count.toLocaleString("pt-BR")})
                </span>
              )),
            )}
            .
          </>
        ) : null}
      </p>
    </section>
  );
}
