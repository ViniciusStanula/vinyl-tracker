import Link from "next/link";
import { HubHeader, HubTile, SectionRule } from "@/components/hub/HubUI";
import { getArtistaLetterCounts, getArtistasList } from "@/lib/db/artista";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";
import type { Metadata } from "next";

export const revalidate = 14400;

const FEATURED_COUNT = 5;

/** Must match the folding in components/hub/ArtistasFilter.tsx. */
function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** True for compilation / placeholder artist names that shouldn't headline the
 *  mosaic — "Various", "Various Artists", the unknown-artist sentinel, and the
 *  title-parser junk values ("por", "Disco de Vinil"). Substring match on
 *  "various" also catches the "… / Various" compilation titles. */
function isCompilationArtist(artista: string): boolean {
  const a = fold(artista);
  return (
    a.includes("various") ||
    a.includes("nao identificad") ||
    a === "por" ||
    a === "disco de vinil"
  );
}

export const metadata: Metadata = {
  title: "Artistas de Vinil — Catálogo Completo | Garimpa Vinil",
  description:
    "Navegue todos os artistas com discos de vinil disponíveis na Amazon Brasil. Clique em qualquer artista para ver o catálogo com histórico de preços.",
  alternates: { canonical: "/artistas" },
  openGraph: {
    title: "Artistas de Vinil — Catálogo Completo | Garimpa Vinil",
    description:
      "Navegue todos os artistas com discos de vinil disponíveis na Amazon Brasil.",
    url: "/artistas",
    type: "website",
    images: ["/og-default.png"],
  },
};

export default async function ArtistasIndexPage() {
  let artistas: Awaited<ReturnType<typeof getArtistasList>> = [];
  let letterCounts: Awaited<ReturnType<typeof getArtistaLetterCounts>> = [];
  try {
    [artistas, letterCounts] = await Promise.all([
      getArtistasList(),
      getArtistaLetterCounts(),
    ]);
  } catch {
    // DB unavailable
  }

  // Most-listened artists lead the mosaic — Last.fm listeners, not disc count,
  // so recognisable names surface instead of "Various Artists" (which has the
  // deepest catalogue by far). Compilation and placeholder names carry a real
  // Last.fm listener count too, so exclude them explicitly rather than trusting
  // the ranking to bury them.
  const featured = [...artistas]
    .filter((a) => a.listeners > 0 && !isCompilationArtist(a.artista))
    .sort((a, b) => b.listeners - a.listeners)
    .slice(0, FEATURED_COUNT);

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Artistas", item: `${SITE_URL}/artistas` },
    ],
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      <nav aria-label="Navegação estrutural" className="flex items-center gap-1.5 text-sm text-dust mb-6">
        <Link href="/" className="hover:text-cream transition-colors">Início</Link>
        <span aria-hidden="true">›</span>
        <span className="text-parchment">Artistas</span>
      </nav>

      <HubHeader
        eyebrow="Catálogo A–Z"
        title="Artistas de Vinil"
        description={
          artistas.length > 0
            ? `${artistas.length.toLocaleString("pt-BR")} artistas com discos de vinil disponíveis na Amazon Brasil, com histórico de preços de 12 meses.`
            : "Catálogo de artistas com discos de vinil na Amazon Brasil."
        }
      />

      {artistas.length === 0 ? (
        <p className="text-dust text-sm">Nenhum artista disponível no momento.</p>
      ) : (
        <>
          {/* Mosaic of the deepest catalogues. Hidden while filtering — it
              isn't part of the A–Z index the filter narrows. */}
          {featured.length === FEATURED_COUNT && (
            <section
              aria-label="Artistas mais ouvidos"
              className="mb-10 sm:mb-14"
              data-letra-section
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <HubTile
                  href={`/artista/${featured[0].slug}`}
                  label={featured[0].artista}
                  count={featured[0].discoCount}
                  badge="Mais ouvido"
                  featured
                />
                <div className="grid grid-cols-2 gap-4">
                  {featured.slice(1).map((item) => (
                    <HubTile
                      key={item.slug}
                      href={`/artista/${item.slug}`}
                      label={item.artista}
                      count={item.discoCount}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          <SectionRule
            id="indice-heading"
            title="Índice completo"
            aside={
              <p className="text-xs text-dust">
                {artistas.length.toLocaleString("pt-BR")} artistas
              </p>
            }
          />

          {/* Letter tiles rather than every artist. The index used to render
              all 11,999 of them on one page — 9.2 MB of HTML plus the matching
              RSC payload — on a route the header menu now links from every
              page. Each letter is its own route, the largest being T at 1,302.

              Artist discovery does not depend on this page: sitemap/artistas.xml
              lists every artist page directly. */}
          <nav aria-label="Artistas por letra" className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-3">
            {letterCounts.map(({ letra, total }) => (
              <Link
                key={letra}
                href={`/artistas/${letra === "#" ? "outros" : letra.toLowerCase()}`}
                className="flex flex-col items-center justify-center rounded-xl border border-groove bg-sleeve py-4 hover:border-gold/50 hover:bg-groove/40 transition-colors"
              >
                <span className="font-display text-2xl font-black text-cream leading-none">
                  {letra === "#" ? "#" : letra}
                </span>
                <span className="mt-1 text-[11px] text-dust tabular-nums">
                  {total.toLocaleString("pt-BR")}
                </span>
              </Link>
            ))}
          </nav>

          {/* Prose below the index: the mosaic and the letter grid left this
              hub at 50 words, the thinnest page in the 24 Aug crawl after
              /estilo/future-garage. */}
          <section aria-labelledby="sobre-artistas" className="mt-14 max-w-2xl">
            <h2 id="sobre-artistas" className="font-display text-xl font-black text-cream mb-4">
              Como este catálogo é montado
            </h2>
            <div className="flex flex-col gap-4 text-parchment text-sm leading-relaxed">
              <p>
                Um artista entra nesta lista quando tem pelo menos um vinil à venda
                na Amazon Brasil com histórico de preço já acumulado. Discos que
                acabaram de entrar no catálogo ficam de fora até juntarem
                observações suficientes para o gráfico dizer alguma coisa — sem
                isso, o preço apareceria sem nada com que compará-lo.
              </p>
              <p>
                Os nomes vêm da página do produto e são conferidos contra o
                MusicBrainz e o Discogs, que corrigem grafias invertidas, variações
                de acentuação e créditos de coletânea listados como se fossem banda.
                Álbuns de vários intérpretes ficam sob o nome que a ficha do
                lançamento traz como principal.
              </p>
              <p>
                A página de cada artista reúne os vinis disponíveis, os que estão
                fora de estoque no momento e os estilos que o catálogo dele
                atravessa. Use o índice A–Z acima para navegar, ou a busca no topo
                do site quando já souber o nome.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
