import Link from "next/link";
import type { Metadata } from "next";
import { getSitemapData } from "@/lib/db/sitemap";

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
  { nome: "Início",                  href: "/" },
  { nome: "Todos os Discos",         href: "/disco" },
  { nome: "Discos Abaixo de R$200",  href: "/discos-abaixo-de-200" },
  { nome: "Artistas Mais Ouvidos",   href: "/artistas-mais-ouvidos" },
  { nome: "Mapa do Site",            href: "/sitemap" },
  { nome: "Sobre",                   href: "/sobre" },
  { nome: "Política de Privacidade", href: "/politica-de-privacidade" },
  { nome: "Termos de Uso",           href: "/termos-de-uso" },
];

const GUIAS_PAGES = [
  { nome: "Guias de Vinil",                          href: "/guias" },
  { nome: "Como Cuidar de Discos de Vinil",          href: "/guias/como-cuidar-de-discos-de-vinil" },
  { nome: "Melhores Discos de Rock por Subgênero",   href: "/guias/rock" },
  { nome: "Top Artistas do Spotify por País",        href: "/guias/top-artistas-spotify" },
];

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

      {/* ── Guias ───────────────────────────────────────────────── */}
      <section className="mb-8 bg-sleeve border border-groove rounded-xl p-6">
        <h2 className="font-display text-xl font-bold text-cream mb-4">Guias</h2>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {GUIAS_PAGES.map(({ nome, href }) => (
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
