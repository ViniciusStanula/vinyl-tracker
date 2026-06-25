import { queryDiscosWithCache } from "@/lib/queryDiscos";
import { PEER_ORIGIN } from "@/lib/hreflang";
import { SITE_URL } from "@/lib/siteUrl";
import { formatDiscoCount } from "@/lib/utils/formatters";
import { getDiscoCount } from "@/lib/db/home";
import { queryCarouselDiscosWithCache } from "@/lib/db/carousel";
import SortBar from "@/components/SortBar";
import InfiniteGrid from "@/components/InfiniteGrid";
import ArtistasCarousel from "@/components/ArtistasCarousel";
import BackToTop from "@/components/BackToTop";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";

const HIDE_PRICE_HISTORY = process.env.NEXT_PUBLIC_HIDE_PRICE_HISTORY !== "false";

// Reversible hero test: set HIDE_HERO=1 to remove the hero banner.
// When hidden, the carousel moves into the first fold and its first slides
// (priority images in DiscoCard) become the LCP candidates.
const SHOW_HERO = process.env.HIDE_HERO !== "1";

export const revalidate = 14400;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; artista?: string; page?: string; precoMax?: string }>;
}) {
  const { q, page } = await searchParams;
  const HOME_TITLE = "Garimpa Vinil — Histórico de Preços de Discos de Vinil";
  // Search results: noindex. robots.txt also disallows ?q= as belt-and-suspenders.
  if (q?.trim()) {
    return { title: HOME_TITLE, robots: { index: false, follow: true } };
  }
  // Pagination: noindex + self-canonical. Page N is not a duplicate of page 1,
  // so canonical must not point to page 1. sort/artista/precoMax variants are
  // indexable and consolidate to base via proxy's cross-URL canonical header.
  const pageNum = page !== undefined ? parseInt(page, 10) : 1;
  if (pageNum > 1) {
    return {
      title: HOME_TITLE,
      robots: { index: false, follow: true },
      alternates: { canonical: `${SITE_URL}/?page=${pageNum}` },
    };
  }
  let count = 0;
  try {
    count = await getDiscoCount();
  } catch {
    // DB unavailable — fall back to generic description
  }
  const description = count > 0
    ? `Acompanhe o preço de +${count.toLocaleString("pt-BR")} discos de vinil na Amazon Brasil. Histórico de 12 meses, alertas de queda e o melhor momento de comprar cada disco.`
    : "Acompanhe os preços de discos de vinil na Amazon Brasil. Histórico de 12 meses, alertas de queda e o melhor momento de comprar cada disco.";
  return {
    title: HOME_TITLE,
    description,
    alternates: {
      canonical: SITE_URL,
      languages: {
        "pt-BR": SITE_URL,
        "en-US": `${PEER_ORIGIN}/`,
        "x-default": `${PEER_ORIGIN}/`,
      },
    },
    openGraph: {
      title: HOME_TITLE,
      description,
      url: "/",
      type: "website",
      images: ["/og-default.png"],
    },
    twitter: {
      card: "summary",
      title: HOME_TITLE,
      description,
    },
  };
}

// Top genres surfaced as quick-links below the artist carousel.
const GENRE_LINKS = [
  { label: "Rock",       slug: "rock" },
  { label: "Jazz",       slug: "jazz" },
  { label: "MPB",        slug: "mpb" },
  { label: "Pop",        slug: "pop" },
  { label: "Clássica",   slug: "classical" },
  { label: "Reggae",     slug: "reggae" },
] as const;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    artista?: string;
    page?: string;
    precoMax?: string;
  }>;
}) {
  const {
    q,
    sort = "desconto",
    artista,
    page: pageStr,
    precoMax: precoMaxStr,
  } = await searchParams;

  const page       = Math.max(1, parseInt(pageStr ?? "1", 10));
  const searchTerm = q?.trim() ?? "";
  const precoMax   = precoMaxStr ? Number(precoMaxStr) : null;

  // Fetch grid, count, and carousel in parallel. Carousel is awaited inline
  // (no Suspense) so its HTML ships in the initial flush — no skeleton swap,
  // and the first slides' priority images are discovered immediately.
  // Cache misses are absorbed by the crawler's post-purge warm-up GETs.
  let items: Awaited<ReturnType<typeof queryDiscosWithCache>>["items"] = [];
  let total = 0, totalPages = 0;
  let count = 0;
  let carouselItems: Awaited<ReturnType<typeof queryCarouselDiscosWithCache>> = [];
  try {
    ([{ items, total, totalPages }, count, carouselItems] = await Promise.all([
      queryDiscosWithCache({ searchTerm, sort, artista, precoMax, page }),
      getDiscoCount(),
      searchTerm || artista ? Promise.resolve([]) : queryCarouselDiscosWithCache(),
    ]));
  } catch {
    // DB unavailable — render empty state
  }

  const currentPage = Math.min(page, totalPages);

  return (
    <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">

      {/* ── Hero — removable via HIDE_HERO=1 (reversible LCP test) ── */}
      {SHOW_HERO && (
      <header className="relative mb-8 overflow-hidden rounded-2xl border border-groove min-h-[300px] sm:min-h-[360px] flex items-center">
        {/* Background photo */}
        <Image
          src="/hero-turntable.jpg"
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="(max-width: 1280px) 100vw, 1280px"
        />
        {/* Gradient overlay — left-heavy so text is readable */}
        <div className="absolute inset-0 bg-gradient-to-r from-record via-record/75 to-record/10" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-record/60 to-transparent sm:hidden" aria-hidden="true" />

        {/* Content */}
        <div className="relative z-10 px-6 py-8 sm:py-14 max-w-lg">
          <span className="text-gold text-[11px] font-bold uppercase tracking-[0.2em] block mb-3">
            Amazon Brasil · Curadoria Especializada
          </span>
          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-black leading-[0.95] mb-4 [text-wrap:balance]">
            <span className="italic text-cream">Histórico de Preços</span>
            <br />
            <span className="not-italic text-gold">de Discos de Vinil</span>
          </h1>
          <p className="text-cream text-sm sm:text-base max-w-md leading-relaxed mb-4">
            Catálogo de discos de vinil na Amazon Brasil com preços atualizados. Encontre bons momentos para comprar.
          </p>
          {count > 0 && (
            <p className="text-dust text-xs font-medium tabular-nums mb-5 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              +{count.toLocaleString("pt-BR")} discos disponíveis
              <span aria-hidden="true" className="opacity-40">·</span>
              Preços atualizados regularmente
            </p>
          )}
          <div className="flex gap-3 flex-wrap">
            <Link
              href="/ofertas"
              className="inline-flex items-center gap-2 bg-gold hover:bg-goldlit text-record font-bold text-sm px-6 py-3 rounded-xl transition-colors"
            >
              Ver Ofertas de Hoje
            </Link>
            <Link
              href="/sobre"
              className="inline-flex items-center gap-2 border border-wax text-cream hover:bg-groove text-sm px-6 py-3 rounded-xl transition-colors font-medium"
            >
              Sobre o site
            </Link>
          </div>
        </div>
      </header>
      )}

      {/* ── Artistas mais Ouvidos carousel ──────────────────────── */}
      <ArtistasCarousel items={carouselItems} />

      {/* ── Genre quick-links ────────────────────────────────────── */}
      {!searchTerm && !artista && (
        <nav aria-label="Explorar por estilo" className="flex flex-wrap gap-2 mb-6">
          {GENRE_LINKS.map(({ label, slug }) => (
            <Link
              key={slug}
              href={`/estilo/${slug}`}
              className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full bg-groove border border-wax/40 text-dust hover:text-parchment hover:border-wax/70 transition-colors"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/artistas"
            className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full bg-groove border border-wax/40 text-dust hover:text-parchment hover:border-wax/70 transition-colors"
          >
            Ver todos os artistas →
          </Link>
        </nav>
      )}

      {/* ── Sort bar ────────────────────────────────────────────── */}
      <div className="sticky top-[62px] z-40 mb-3 bg-record/95 backdrop-blur-md -mx-4 px-4 pt-2 pb-2">
        <Suspense>
          <SortBar />
        </Suspense>
      </div>

      {/* ── Deal badge legend — suppressed when HIDE_PRICE_HISTORY */}
      {!HIDE_PRICE_HISTORY && (
        <p className="text-xs text-dust mb-4 leading-relaxed">
          <span className="text-gold font-semibold">✦ Melhor Preço</span> = menor preço registrado
          {" · "}
          <span className="text-deallit font-semibold">✓ Ótima Oferta</span> = abaixo da média histórica
          {" · "}
          Boa Oferta = com desconto ativo
        </p>
      )}

      {/* ── Result count + active artist badge ──────────────────── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <p className="text-dust text-sm">
          {formatDiscoCount(total)}
          {searchTerm && (
            <span className="text-parchment">
              {" "}para{" "}
              <span className="text-cream">&ldquo;{q}&rdquo;</span>
            </span>
          )}
        </p>
        {artista && (
          <span className="inline-flex items-center gap-1.5 bg-groove border border-wax/60 text-parchment text-xs px-3 py-1 rounded-full">
            {artista}
            <Link
              href="/"
              className="text-dust hover:text-cream transition-colors leading-none"
              aria-label="Remover filtro de artista"
            >
              ×
            </Link>
          </span>
        )}
      </div>

      {/* ── Grid + Pagination ───────────────────────────────────── */}
      {items.length > 0 ? (
        <InfiniteGrid
          initialItems={items}
          currentPage={currentPage}
          totalPages={totalPages}
          searchParams={{ q, sort, artista, precoMax: precoMaxStr }}
          animationKey={`${sort}-${q ?? ""}-${artista ?? ""}-${currentPage}`}
          basePath="/disco"
        />
      ) : (
        <section aria-label="Sem resultados" className="text-center py-24 text-dust">
          <div className="inline-block mb-5 opacity-40">
            <svg viewBox="0 0 64 64" fill="none" className="w-16 h-16 mx-auto" aria-hidden="true">
              <circle cx="32" cy="32" r="30" className="fill-gold" opacity="0.3" />
              <circle cx="32" cy="32" r="20" className="fill-record" opacity="0.8" />
              <circle cx="32" cy="32" r="5"  className="fill-gold" opacity="0.4" />
              <circle cx="32" cy="32" r="2"  className="fill-record" />
            </svg>
          </div>
          <p className="font-display text-parchment text-lg font-semibold mb-2">
            Nenhum disco encontrado
          </p>
          <p className="text-dust text-sm mb-6">
            Tente ajustar os filtros ou buscar por outro artista.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-gold hover:bg-goldlit text-record font-bold text-sm px-6 py-2.5 rounded-full transition-colors"
          >
            Ver todos os discos
          </Link>
        </section>
      )}

      {/* ── Guias quick-links — discovery footer ─────────────────── */}
      {!searchTerm && !artista && (
        <section aria-label="Guias de vinil" className="mt-12 pt-8 border-t border-groove">
          <h2 className="font-display text-lg font-bold text-cream mb-3">Guias de Vinil</h2>
          <nav className="flex flex-wrap gap-2">
            {[
              { href: "/guias/como-cuidar-de-discos-de-vinil", label: "Como cuidar do vinil" },
              { href: "/guias/vinil-180g-vale-a-pena",         label: "Vinil 180g vale a pena?" },
              { href: "/guias/vinil-colorido-e-picture-disc",  label: "Colorido e picture disc" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full bg-groove border border-wax/40 text-dust hover:text-parchment hover:border-wax/70 transition-colors"
              >
                {label}
              </Link>
            ))}
            <Link
              href="/guias"
              className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full bg-groove border border-wax/40 text-dust hover:text-parchment hover:border-wax/70 transition-colors"
            >
              Todos os guias →
            </Link>
          </nav>
        </section>
      )}

      <BackToTop />
    </main>
  );
}
