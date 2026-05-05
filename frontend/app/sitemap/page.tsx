import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { slugifyArtist } from "@/lib/slugify";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import type { Metadata } from "next";

// Must match ACCENT_FROM/ACCENT_TO in estilo/[slug]/page.tsx and artista/[slug]/page.tsx
// so that SQL-generated style slugs resolve correctly in the estilo page.
const ACCENT_FROM = Prisma.raw(`'áàâãäåéèêëíìîïóòôõöúùûüçñý'`);
const ACCENT_TO   = Prisma.raw(`'aaaaaaeeeeiiiioooouuuucny'`);

export const metadata: Metadata = {
  title: "Mapa do Site — Garimpa Vinil",
  description:
    "Todas as páginas do Garimpa Vinil: artistas, estilos musicais e seções do site.",
  alternates: { canonical: "/sitemap" },
  openGraph: {
    title: "Mapa do Site — Garimpa Vinil",
    description:
      "Todas as páginas do Garimpa Vinil: artistas, estilos musicais e seções do site.",
    url: "/sitemap",
    type: "website",
  },
};

const STATIC_PAGES = [
  { nome: "Início",         href: "/" },
  { nome: "Todos os Discos", href: "/disco" },
  { nome: "Sobre",          href: "/sobre" },
];

const getSitemapData = unstable_cache(
  async () => {
    const [artistaRows, styleRows] = await Promise.all([
      prisma.$queryRaw<{ artista: string }[]>`
        SELECT DISTINCT artista
        FROM   "Disco"
        WHERE  disponivel = TRUE
          AND  price_count >= 5
        ORDER  BY artista
      `,
      // Generate slugs in SQL using the exact same translate() expression the
      // estilo page uses for its canonical lookup — guarantees every link resolves.
      // Deduplicate by slug, keeping one display name per slug (min tag).
      prisma.$queryRaw<{ slug: string; nome: string }[]>`
        WITH tags AS (
          SELECT DISTINCT unnest(string_to_array(lastfm_tags, ', ')) AS tag
          FROM   "Disco"
          WHERE  lastfm_tags IS NOT NULL
            AND  lastfm_tags != ''
            AND  disponivel = TRUE
            AND  price_count >= 5
        ),
        slugged AS (
          SELECT
            tag,
            regexp_replace(
              regexp_replace(
                translate(lower(tag), ${ACCENT_FROM}, ${ACCENT_TO}),
                '[^a-z0-9]+', '-', 'g'
              ),
              '^-+|-+$', '', 'g'
            ) AS slug
          FROM tags
        )
        SELECT slug, min(tag) AS nome
        FROM   slugged
        WHERE  slug != ''
        GROUP  BY slug
        ORDER  BY slug
      `,
    ]);

    // Deduplicate artists by slug (multiple name variants → same slug).
    // Must use JS slugifyArtist() because the artist page's JS safety net
    // (slugifyArtist(a) === slug) must also pass — SQL translate alone isn't enough.
    const seenSlug = new Set<string>();
    const artists: { nome: string; slug: string }[] = [];
    for (const { artista } of artistaRows) {
      const slug = slugifyArtist(artista);
      if (!slug || seenSlug.has(slug)) continue;
      seenSlug.add(slug);
      artists.push({ nome: artista, slug });
    }

    const styles = styleRows.map(({ slug, nome }) => ({ slug, nome }));

    return { artists, styles };
  },
  ["sitemap-page"],
  { tags: ["prices"], revalidate: 3600 },
);

// Group artists alphabetically by first letter
function groupByLetter(artists: { nome: string; slug: string }[]) {
  const map = new Map<string, { nome: string; slug: string }[]>();
  for (const a of artists) {
    const letter = a.nome[0]?.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "") ?? "#";
    const key = /[A-Z]/.test(letter) ? letter : "#";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  return [...map.entries()].sort(([a], [b]) => {
    if (a === "#") return 1;
    if (b === "#") return -1;
    return a.localeCompare(b);
  });
}

export default async function SitemapPage() {
  let artists: { nome: string; slug: string }[] = [];
  let styles: { nome: string; slug: string }[] = [];

  try {
    ({ artists, styles } = await getSitemapData());
  } catch {
    // DB unavailable — render with only static pages
  }

  const grouped = groupByLetter(artists);

  return (
    <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">
      {/* ── Breadcrumbs ─────────────────────────────────────────── */}
      <nav className="mb-6 text-sm text-dust flex gap-2">
        <Link href="/" className="hover:text-gold transition-colors">Início</Link>
        <span>›</span>
        <span className="text-parchment">Mapa do Site</span>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <header className="relative mb-8 overflow-hidden rounded-2xl bg-sleeve border border-groove px-6 py-7 vinyl-grooves">
        <h1 className="font-display text-3xl sm:text-4xl font-black text-cream leading-tight">
          Mapa do <span className="text-gold">Site</span>
        </h1>
        <p className="mt-3 text-parchment text-sm max-w-lg leading-relaxed">
          Todas as páginas do Garimpa Vinil — artistas, estilos musicais e seções principais.
        </p>
      </header>

      {/* ── Páginas estáticas ───────────────────────────────────── */}
      <section className="mb-8 bg-sleeve border border-groove rounded-xl p-6">
        <h2 className="font-display text-xl font-bold text-cream mb-4">Páginas</h2>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {STATIC_PAGES.map(({ nome, href }) => (
            <li key={href}>
              <Link href={href} className="text-parchment hover:text-gold transition-colors text-sm">
                {nome}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Estilos ─────────────────────────────────────────────── */}
      {styles.length > 0 && (
        <section className="mb-8 bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-xl font-bold text-cream mb-4">
            Estilos{" "}
            <span className="text-dust text-sm font-normal font-sans ml-1">
              ({styles.length})
            </span>
          </h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-2">
            {styles.map(({ nome, slug }) => (
              <li key={slug}>
                <Link
                  href={`/estilo/${slug}`}
                  className="text-dust hover:text-cream transition-colors text-sm capitalize"
                >
                  {nome}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Artistas ────────────────────────────────────────────── */}
      {artists.length > 0 && (
        <section className="bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-xl font-bold text-cream mb-2">
            Artistas{" "}
            <span className="text-dust text-sm font-normal font-sans ml-1">
              ({artists.length})
            </span>
          </h2>

          {/* Letter jump links */}
          <nav className="flex flex-wrap gap-1.5 mb-6" aria-label="Navegar por letra">
            {grouped.map(([letter]) => (
              <a
                key={letter}
                href={`#letra-${letter}`}
                className="inline-flex items-center justify-center w-7 h-7 rounded bg-groove hover:bg-wax text-parchment hover:text-cream text-xs font-semibold transition-colors"
              >
                {letter}
              </a>
            ))}
          </nav>

          <div className="space-y-8">
            {grouped.map(([letter, group]) => (
              <div key={letter} id={`letra-${letter}`}>
                <h3 className="text-gold font-display font-bold text-lg mb-3 border-b border-groove pb-1">
                  {letter}
                </h3>
                <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-1.5">
                  {group.map(({ nome, slug }) => (
                    <li key={slug}>
                      <Link
                        href={`/artista/${slug}`}
                        className="text-dust hover:text-cream transition-colors text-sm truncate block"
                        title={nome}
                      >
                        {nome}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
