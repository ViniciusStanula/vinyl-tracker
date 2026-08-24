import Link from "next/link";
import { HubHeader, HubTile } from "@/components/hub/HubUI";
import { getDecadasList } from "@/lib/db/decada";
import { decadaLabel } from "@/lib/decadas";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";
import type { Metadata } from "next";

export const revalidate = 14400;

export const metadata: Metadata = {
  title: "Discos de Vinil por Década | Garimpa Vinil",
  description:
    "Explore discos de vinil por década de lançamento. Anos 50 a anos 2020 — cada década com histórico de preços de 12 meses na Amazon Brasil.",
  alternates: { canonical: "/decadas" },
  openGraph: {
    title: "Discos de Vinil por Década | Garimpa Vinil",
    description: "Explore discos de vinil por década de lançamento.",
    url: "/decadas",
    type: "website",
    images: ["/og-default.png"],
  },
};

/** Entries listed in this hub's ItemList JSON-LD. */
const HUB_LIST_CAP = 100;

export default async function DecadasIndexPage() {
  let decadas: Awaited<ReturnType<typeof getDecadasList>> = [];
  try {
    decadas = await getDecadasList();
  } catch {
    // DB unavailable
  }

  const topDecada = decadas.length
    ? decadas.reduce((best, d) => (d.discoCount > best.discoCount ? d : best)).start
    : null;

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Décadas", item: `${SITE_URL}/decadas` },
    ],
  });

  // The hub's own links, as a list. These pages carried a breadcrumb and
  // nothing else, so the markup said a page existed here and never that it
  // indexes the whole facet — the counts and destinations were visible to a
  // reader and invisible to a parser.
  const itemListJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Discos de vinil por década",
    url: `${SITE_URL}/decadas`,
    numberOfItems: decadas.length,
    // numberOfItems stays the true total; the entries themselves are capped.
    // Listing all 688 styles cost 77KB of markup on one page — a parser needs
    // the shape of the list and the count, not every row, and the visible page
    // and the sitemap both still carry the full set.
    itemListElement: decadas.slice(0, HUB_LIST_CAP).map((d, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `Vinis dos ${d.start}`,
      url: `${SITE_URL}/decada/${d.start}`,
    })),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJsonLd }} />

      <nav aria-label="Navegação estrutural" className="flex items-center gap-1.5 text-sm text-dust mb-6">
        <Link href="/" className="hover:text-cream transition-colors">Início</Link>
        <span aria-hidden="true">›</span>
        <span className="text-parchment">Décadas</span>
      </nav>

      <HubHeader
        eyebrow="Por década"
        title="Discos por Década"
        description={`Discos de vinil agrupados pela década de lançamento${
          decadas.length > 0 ? `, das mais antigas às mais recentes — ${decadas.length} décadas monitoradas` : ""
        } na Amazon Brasil.`}
      />

      {/* Only eight decades, so the mosaic is the whole page — no filter or
          A–Z index, which would be noise at this size. Ordered newest first;
          the decade with the most records carries the badge. */}
      <ul className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {decadas.map((d) => (
          <li key={d.start}>
            <HubTile
              href={`/decada/${d.start}`}
              label={decadaLabel(d.start)}
              count={d.discoCount}
              badge={d.start === topDecada ? "Mais discos" : undefined}
            />
          </li>
        ))}
      </ul>

      {/* Prose below the grid: the tiles alone left this hub at 74 words, thin
          enough that the 24 Aug crawl flagged it. */}
      <section aria-labelledby="sobre-decadas" className="mt-14 max-w-2xl">
        <h2 id="sobre-decadas" className="font-display text-xl font-black text-cream mb-4">
          Como a década é definida aqui
        </h2>
        <div className="flex flex-col gap-4 text-parchment text-sm leading-relaxed">
          <p>
            A década vem do ano de lançamento original do álbum, não do ano em que
            a prensagem à venda foi fabricada. Um <em>Rumours</em> reprensado em 2023
            aparece nos anos 70, junto do disco que ele reedita. Sem isso, todo
            catálogo de vinil novo se amontoaria nas duas décadas mais recentes.
          </p>
          <p>
            O ano vem do MusicBrainz e do Discogs, cruzados: quando as duas fontes
            discordam, vale a data mais antiga de lançamento do álbum. Discos sem ano
            confiável ficam de fora destas páginas em vez de entrar na década errada.
          </p>
          <p>
            Cada página de década lista os vinis disponíveis na Amazon Brasil com o
            preço acompanhado todo dia e o gráfico de 12 meses. Serve para duas
            buscas diferentes: garimpar um período inteiro sem ter um título em
            mente, e comparar quanto custa hoje uma reedição contra o que ela custava
            há alguns meses.
          </p>
        </div>
      </section>
    </div>
  );
}
