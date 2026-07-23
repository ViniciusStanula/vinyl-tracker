import Link from "next/link";
import { HubHeader, HubTile, SectionRule, formatDiscos } from "@/components/hub/HubUI";
import ArtistasFilter from "@/components/hub/ArtistasFilter";
import { getArtistasList } from "@/lib/db/artista";
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
  try {
    artistas = await getArtistasList();
  } catch {
    // DB unavailable
  }

  // Group by first letter (non-letter names go under "#")
  const grouped = new Map<string, typeof artistas>();
  for (const item of artistas) {
    const first = item.artista.match(/^[A-Za-z]/)
      ? item.artista[0].toUpperCase()
      : "#";
    if (!grouped.has(first)) grouped.set(first, []);
    grouped.get(first)!.push(item);
  }
  const letters = Array.from(grouped.keys()).sort((a, b) =>
    a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)
  );

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
        aside={artistas.length > 0 ? <ArtistasFilter total={artistas.length} /> : undefined}
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
              <nav aria-label="Ir para letra" className="flex flex-wrap gap-1">
                {letters.map((l) => (
                  <a
                    key={l}
                    href={`#letra-${l}`}
                    className="font-mono flex h-8 w-8 items-center justify-center rounded border border-groove text-[11px] font-medium text-parchment hover:border-gold hover:text-cream transition-colors"
                  >
                    {l}
                  </a>
                ))}
              </nav>
            }
          />

          {letters.map((letter) => {
            const group = grouped.get(letter)!;
            return (
              <div
                key={letter}
                id={`letra-${letter}`}
                className="mb-8 scroll-mt-24"
                data-letra-section
              >
                <h3 className="font-mono mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
                  {letter}
                </h3>
                <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {group.map((item) => (
                    /* data-nome is the folded name the CSS filter matches on. */
                    <li key={item.slug} data-artista-item data-nome={fold(item.artista)}>
                      <Link href={`/artista/${item.slug}`} className="ax-card">
                        <span className="ax-card__name">{item.artista}</span>
                        <span className="ax-card__count">{formatDiscos(item.discoCount)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
