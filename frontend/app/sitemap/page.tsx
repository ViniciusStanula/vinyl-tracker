import Link from "next/link";
import type { Metadata } from "next";
import { getSitemapData } from "@/lib/db/sitemap";
import { getPaisesList } from "@/lib/db/pais";
import { getCoresList } from "@/lib/db/vinilColorido";
import { getEdicoesList } from "@/lib/db/edicaoVinil";
import { getGravadorasList } from "@/lib/db/gravadora";
import { getArtistaLetterCounts } from "@/lib/db/artista";
import { BEST_OF_ARTISTS } from "@/lib/guias/best-of-artist-data";
import { getRockSubgenres } from "@/lib/guias/rock-data";
import { DECADES, decadaLabel } from "@/lib/decadas";

const DESCRIPTION =
  "Todas as seções do Garimpa Vinil: artistas, estilos musicais, décadas, países, cores de vinil, edições especiais e guias.";

export const metadata: Metadata = {
  title: "Mapa do Site | Garimpa Vinil",
  description: DESCRIPTION,
  alternates: { canonical: "/sitemap" },
  openGraph: {
    title: "Mapa do Site | Garimpa Vinil",
    description: DESCRIPTION,
    url: "/sitemap",
    type: "website",
    images: ["/og-default.png"],
  },
};

const STATIC_PAGES = [
  { nome: "Início",                  href: "/" },
  { nome: "Todos os Discos",         href: "/disco" },
  { nome: "Ofertas",                 href: "/ofertas" },
  { nome: "Discos Abaixo de R$200",  href: "/discos-abaixo-de-200" },
  { nome: "Estilos Musicais",        href: "/estilos" },
  { nome: "Países de Origem",        href: "/paises" },
  { nome: "Discos por Década",       href: "/decadas" },
  { nome: "Gravadoras",              href: "/gravadoras" },
  { nome: "Vinil Colorido",          href: "/vinil-colorido" },
  { nome: "Edições Especiais",       href: "/edicao" },
  { nome: "Artistas (A–Z)",          href: "/artistas" },
  { nome: "Artistas Mais Ouvidos",   href: "/artistas-mais-ouvidos" },
  { nome: "Alertas de Preço",        href: "/alertas" },
  { nome: "Mapa do Site",            href: "/sitemap" },
  { nome: "Sobre",                   href: "/sobre" },
  { nome: "Política de Privacidade", href: "/politica-de-privacidade" },
  { nome: "Termos de Uso",           href: "/termos-de-uso" },
];

const GUIAS_PAGES = [
  { nome: "Guias de Vinil",                          href: "/guias" },
  { nome: "Como Cuidar de Discos de Vinil",          href: "/guias/como-cuidar-de-discos-de-vinil" },
  { nome: "Vinil Colorido e Picture Disc",            href: "/guias/vinil-colorido-e-picture-disc" },
  { nome: "Vinil 180g Vale a Pena?",                 href: "/guias/vinil-180g-vale-a-pena" },
  { nome: "Como Avaliar o Estado de um Disco",       href: "/guias/como-avaliar-estado-disco-vinil" },
  { nome: "Toca-Discos para Iniciantes",             href: "/guias/toca-discos-para-iniciantes" },
  { nome: "Pré-Amplificador Phono",                  href: "/guias/pre-amplificador-phono" },
  { nome: "Melhores Discos de Rock por Subgênero",   href: "/guias/rock" },
  // Best-of-artist rankings — kept in sync with the XML sitemap via BEST_OF_ARTISTS.
  ...BEST_OF_ARTISTS.map((a) => ({
    nome: `Melhores Discos ${a.article} ${a.name}`,
    href: `/guias/melhores-discos/${a.slug}`,
  })),
];

export default async function SitemapPage() {
  let styles: { nome: string; slug: string }[] = [];
  let paises: Awaited<ReturnType<typeof getPaisesList>> = [];
  let cores: Awaited<ReturnType<typeof getCoresList>> = [];
  let edicoes: Awaited<ReturnType<typeof getEdicoesList>> = [];
  let letras: Awaited<ReturnType<typeof getArtistaLetterCounts>> = [];
  let gravadoras: Awaited<ReturnType<typeof getGravadorasList>> = [];

  // Settled independently rather than one Promise.all in a try/catch: this page
  // is a crawl surface, and a single slow or failing query used to blank every
  // section on it — one saturated pool and the whole map rendered as nothing
  // but the static links. Each section now stands or falls on its own.
  const [stylesR, paisesR, coresR, edicoesR, letrasR, gravadorasR] = await Promise.allSettled([
    getSitemapData(),
    getPaisesList(),
    getCoresList(),
    getEdicoesList(),
    getArtistaLetterCounts(),
    getGravadorasList(),
  ]);
  if (stylesR.status === "fulfilled") styles = stylesR.value.styles;
  if (paisesR.status === "fulfilled") paises = paisesR.value;
  if (coresR.status === "fulfilled") cores = coresR.value;
  if (edicoesR.status === "fulfilled") edicoes = edicoesR.value;
  if (letrasR.status === "fulfilled") letras = letrasR.value;
  if (gravadorasR.status === "fulfilled") gravadoras = gravadorasR.value;

  // Reads enriched_data.json off disk, so it fails independently of the DB.
  let rockSubgenres: ReturnType<typeof getRockSubgenres> = [];
  try {
    rockSubgenres = getRockSubgenres();
  } catch {
    // Data file unavailable — the rest of the map still renders
  }

  const totalArtistas = letras.reduce((n, l) => n + l.total, 0);
  const guias = [
    ...GUIAS_PAGES,
    ...rockSubgenres.map((sg) => ({
      nome: `Melhores Discos de ${sg.name}`,
      href: `/guias/rock/${sg.slug}`,
    })),
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
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
          Todas as seções do Garimpa Vinil — artistas, estilos, décadas, países,
          cores de vinil, edições especiais e guias.
        </p>
      </header>

      {/* ── Páginas estáticas ───────────────────────────────────── */}
      <section className="mb-8 bg-sleeve border border-groove rounded-xl p-6">
        <h2 className="font-display text-xl font-bold text-cream mb-4">
          Páginas{" "}
          <span className="text-dust text-sm font-normal font-sans ml-1">
            ({STATIC_PAGES.length})
          </span>
        </h2>
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
        <h2 className="font-display text-xl font-bold text-cream mb-4">
          Guias{" "}
          <span className="text-dust text-sm font-normal font-sans ml-1">
            ({guias.length})
          </span>
        </h2>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {guias.map(({ nome, href }) => (
            <li key={href}>
              <Link href={href} className="text-parchment hover:text-gold transition-colors text-sm">
                {nome}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Décadas ─────────────────────────────────────────────── */}
      <section className="mb-8 bg-sleeve border border-groove rounded-xl p-6">
        <h2 className="font-display text-xl font-bold text-cream mb-4">
          Décadas{" "}
          <span className="text-dust text-sm font-normal font-sans ml-1">
            ({DECADES.length})
          </span>
        </h2>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {DECADES.map((d) => (
            <li key={d}>
              <Link
                href={`/decada/${d}`}
                className="text-parchment hover:text-gold transition-colors text-sm capitalize"
              >
                {decadaLabel(d)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Cores ───────────────────────────────────────────────── */}
      {cores.length > 0 && (
        <section className="mb-8 bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-xl font-bold text-cream mb-4">
            Cores de Vinil{" "}
            <span className="text-dust text-sm font-normal font-sans ml-1">
              ({cores.length})
            </span>
          </h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-2">
            {cores.map(({ label, slug }) => (
              <li key={slug}>
                <Link
                  href={`/vinil-colorido/${slug}`}
                  className="text-dust hover:text-cream transition-colors text-sm"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Edições ─────────────────────────────────────────────── */}
      {edicoes.length > 0 && (
        <section className="mb-8 bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-xl font-bold text-cream mb-4">
            Edições Especiais{" "}
            <span className="text-dust text-sm font-normal font-sans ml-1">
              ({edicoes.length})
            </span>
          </h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-2">
            {edicoes.map(({ label, slug }) => (
              <li key={slug}>
                <Link
                  href={`/edicao/${slug}`}
                  className="text-dust hover:text-cream transition-colors text-sm"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

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

      {/* ── Gravadoras ──────────────────────────────────────────── */}
      {/* Only labels at or above the listing threshold, which is the same set
          sitemap/gravadoras.xml draws from. The genre × decade cells are
          deliberately absent: 921 links would double this page's link count for
          pages that are already linked from the style they belong to. */}
      {gravadoras.length > 0 && (
        <section className="mb-8 bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-xl font-bold text-cream mb-4">
            Gravadoras{" "}
            <span className="text-dust text-sm font-normal font-sans ml-1">
              ({gravadoras.length})
            </span>
          </h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-2">
            {gravadoras.map(({ label, slug }) => (
              <li key={slug}>
                <Link
                  href={`/gravadora/${slug}`}
                  className="text-dust hover:text-cream transition-colors text-sm"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Países ──────────────────────────────────────────────── */}
      {paises.length > 0 && (
        <section className="mb-8 bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-xl font-bold text-cream mb-4">
            Países{" "}
            <span className="text-dust text-sm font-normal font-sans ml-1">
              ({paises.length})
            </span>
          </h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-2">
            {paises.map(({ nome, slug }) => (
              <li key={slug}>
                <Link
                  href={`/pais/${slug}`}
                  className="text-dust hover:text-cream transition-colors text-sm"
                >
                  {nome}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Artistas ────────────────────────────────────────────── */}
      {/* The 27 letter routes, not the ~12k artists themselves. Listing every
          artist here made this page 6.9 MB of HTML carrying 12,982 links, which
          split the page's link equity ~13,000 ways and cost Googlebot ~1 MB per
          visit. /artistas was already reshaped this way for the same reason.
          No artist becomes unreachable: sitemap/artistas.xml lists every artist
          page directly, and each letter route lists its own. */}
      {letras.length > 0 && (
        <section className="bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-xl font-bold text-cream mb-2">
            Artistas{" "}
            <span className="text-dust text-sm font-normal font-sans ml-1">
              ({totalArtistas.toLocaleString("pt-BR")} em {letras.length} letras)
            </span>
          </h2>
          <p className="text-dust text-sm mb-4">
            Navegue o catálogo completo pela{" "}
            <Link href="/artistas" className="text-gold hover:underline">
              inicial do artista
            </Link>
            .
          </p>

          <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-3">
            {letras.map(({ letra, total }) => (
              <li key={letra}>
                <Link
                  href={`/artistas/${letra === "#" ? "outros" : letra.toLowerCase()}`}
                  className="flex flex-col items-center justify-center rounded-lg border border-groove bg-record py-3 hover:border-gold/50 hover:bg-groove/40 transition-colors"
                >
                  <span className="font-display text-xl font-black text-cream leading-none">
                    {letra}
                  </span>
                  <span className="mt-1 text-[11px] text-dust tabular-nums">
                    {total.toLocaleString("pt-BR")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
