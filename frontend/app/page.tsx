import { queryDiscosWithCache } from "@/lib/queryDiscos";
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

// Reading no searchParams keeps `/` static/ISR-cacheable. Search, sort/filter
// variants, and pagination all live on /disco now (SearchBar + SortBar push
// there), so the homepage renders one canonical view for everyone.
export async function generateMetadata() {
  const HOME_TITLE = "Garimpa Vinil — Histórico de Preços de Discos de Vinil";
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

// The four ways to browse the catalog. Until this section existed, /estilos,
// /decadas and /paises had no inbound links outside their own breadcrumbs, so
// the decade and country axes were unreachable for anyone who didn't guess the
// URL. Static copy on purpose — no counts, so the homepage shell adds no queries.
const BROWSE_LINKS = [
  {
    href: "/estilos",
    label: "Estilo",
    hint: "Rock, jazz, MPB e dezenas de gêneros",
    icon: "M9 19V6l12-3v13M9 19a3 3 0 11-6 0 3 3 0 016 0zm12-3a3 3 0 11-6 0 3 3 0 016 0z",
  },
  {
    href: "/artistas",
    label: "Artista",
    hint: "Catálogo completo e os mais ouvidos",
    icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z",
  },
  {
    href: "/decadas",
    label: "Década",
    hint: "Dos anos 60 aos lançamentos recentes",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    href: "/paises",
    label: "País",
    hint: "Vinis pela origem de cada artista",
    icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
  },
] as const;

// Shared chip styling. Resting colour is `parchment`, not `dust`: dust on a
// groove background is only 3.66:1, which fails WCAG AA for 12px text. py-2.5
// also brings the target height up to ~40px instead of ~28px.
const CHIP_CLASS =
  "inline-flex items-center text-xs font-semibold px-3.5 py-2.5 rounded-full bg-groove border border-wax/40 text-parchment hover:text-cream hover:border-wax/70 transition-colors";

/* Section header: mono eyebrow over a serif headline, mirroring the pattern the
   /estilos and /decadas hubs already use. The mono label is what carries the
   "catalogue" feel — it's the same treatment used for counts and prices. */
function SectionHeader({
  eyebrow,
  title,
  id,
}: {
  eyebrow: string;
  title: string;
  id: string;
}) {
  return (
    <div className="mb-6">
      <span className="font-mono text-gold text-[11px] font-medium uppercase tracking-[0.18em] block mb-2">
        {eyebrow}
      </span>
      <h2 id={id} className="font-display text-2xl sm:text-3xl font-black text-cream leading-tight">
        {title}
      </h2>
      <div className="mt-2 h-0.5 w-10 bg-gold rounded-full" aria-hidden="true" />
    </div>
  );
}

export default async function HomePage() {
  // Hero count + carousel are awaited in the shell so the hero, its LCP image,
  // and the carousel (with head-preloaded priority images) ship inside <main>
  // before the footer — both cheap, cached queries. The heavy grid query streams
  // via <Suspense> below, so it never blocks the shell (TTFB stays low).
  // Cache misses are absorbed by the crawler's post-purge warm-up GETs.
  let count = 0;
  let carouselItems: Awaited<ReturnType<typeof queryCarouselDiscosWithCache>> = [];
  try {
    ([count, carouselItems] = await Promise.all([
      getDiscoCount(),
      queryCarouselDiscosWithCache(),
    ]));
  } catch {
    // DB unavailable — render hero without count, empty carousel
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* ── Hero — removable via HIDE_HERO=1 (reversible LCP test). ── */}
      {SHOW_HERO && (
      <header className="relative mb-10 sm:mb-14 overflow-hidden rounded-xl border border-groove min-h-[300px] sm:min-h-[400px] flex items-center">
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
          <span className="font-mono text-gold text-[11px] font-medium uppercase tracking-[0.18em] block mb-4">
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
            <p className="font-mono text-parchment text-[11px] font-medium tabular-nums mb-6 flex items-center gap-2 flex-wrap">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              +{count.toLocaleString("pt-BR")} discos disponíveis
              <span aria-hidden="true" className="text-wax">·</span>
              Preços atualizados regularmente
            </p>
          )}
          <div className="flex gap-3 flex-wrap">
            <Link
              href="/ofertas"
              className="inline-flex items-center gap-2 bg-gold hover:bg-goldlit text-record font-bold text-sm px-6 py-3 rounded-lg transition-colors"
            >
              Ver Ofertas de Hoje
            </Link>
            <Link
              href="/sobre"
              className="inline-flex items-center gap-2 border border-wax hover:border-gold text-cream hover:bg-groove text-sm px-6 py-3 rounded-lg transition-colors font-medium"
            >
              Sobre o site
            </Link>
          </div>
        </div>
      </header>
      )}

      {/* ── Artistas mais Ouvidos carousel ──────────────────────── */}
      <ArtistasCarousel items={carouselItems} />

      {/* ── Browse dimensions ────────────────────────────────────── */}
      <section aria-labelledby="explorar-heading" className="mb-10 sm:mb-14">
        <SectionHeader
          id="explorar-heading"
          eyebrow="Navegue por"
          title="Explore o catálogo"
        />

        <nav aria-label="Formas de explorar o catálogo">
          <ul className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {BROWSE_LINKS.map(({ href, label, hint, icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="group flex h-full flex-col gap-4 p-4 sm:p-6 rounded-xl bg-sleeve border border-groove hover:border-gold hover:bg-groove transition-colors"
                >
                  <svg
                    className="w-5 h-5 shrink-0 text-gold"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                  </svg>
                  <span className="min-w-0">
                    <span className="font-mono block text-cream text-xs font-bold uppercase tracking-[0.14em] mb-2">
                      {label}
                    </span>
                    <span className="block text-parchment text-xs leading-relaxed">
                      {hint}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      {/* ── Catalogue — header lives in the shell (not in the streamed
             HomeResults) so the h2 is server-rendered, and sits above the
             sticky bar so the bar stays adjacent to the grid it filters. ── */}
      <SectionHeader
        id="catalogo-heading"
        eyebrow="Catálogo completo"
        title="Todos os discos"
      />

      {/* ── Sort bar — navigates to /disco so `/` stays param-free ── */}
      <div className="sticky top-[62px] z-40 mb-3 bg-record/95 backdrop-blur-md -mx-4 px-4 pt-2 pb-2">
        <Suspense>
          <SortBar basePath="/disco" />
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

      {/* ── Result count + grid stream in; everything above ships in the
             shell so the hero, h1, carousel, and links land inside <main>
             before the footer in the server-rendered HTML. */}
      <Suspense fallback={<HomeResultsSkeleton />}>
        <HomeResults />
      </Suspense>

      {/* ── Guias quick-links — discovery footer ─────────────────── */}
      <section aria-labelledby="guias-heading" className="mt-10 sm:mt-14 pt-8 border-t border-groove">
          <SectionHeader
            id="guias-heading"
            eyebrow="Conhecimento"
            title="Guias de Vinil"
          />
          <nav aria-label="Guias de vinil" className="flex flex-wrap gap-2">
            {[
              { href: "/guias/como-cuidar-de-discos-de-vinil", label: "Como cuidar do vinil" },
              { href: "/guias/vinil-180g-vale-a-pena",         label: "Vinil 180g vale a pena?" },
              { href: "/guias/vinil-colorido-e-picture-disc",  label: "Colorido e picture disc" },
            ].map(({ href, label }) => (
              <Link key={href} href={href} className={CHIP_CLASS}>
                {label}
              </Link>
            ))}
            <Link href="/guias" className={CHIP_CLASS}>
              Todos os guias →
            </Link>
          </nav>
        </section>

      <BackToTop />
    </div>
  );
}

async function HomeResults() {
  let items: Awaited<ReturnType<typeof queryDiscosWithCache>>["items"] = [];
  let total = 0, totalPages = 0;
  try {
    ({ items, total, totalPages } = await queryDiscosWithCache({
      searchTerm: "",
      sort: "desconto",
      precoMax: null,
      page: 1,
    }));
  } catch {
    // DB unavailable — render empty state
  }

  return (
    <>
      {/* ── Result count ────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <p className="font-mono text-parchment text-xs font-medium tabular-nums uppercase tracking-[0.08em]">
          {formatDiscoCount(total)}
        </p>
      </div>

      {/* ── Grid + Pagination (page 2+ links continue on /disco) ── */}
      {items.length > 0 ? (
        <InfiniteGrid
          initialItems={items}
          currentPage={1}
          totalPages={totalPages}
          searchParams={{}}
          animationKey="home-default"
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
    </>
  );
}

/* Fallback shown while HomeResults streams — mirrors the old loading.tsx grid. */
function HomeResultsSkeleton() {
  return (
    <>
      <div className="h-4 w-36 bg-groove rounded animate-pulse mb-5" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-sleeve border border-groove rounded-xl overflow-hidden animate-pulse"
          >
            <div className="aspect-square bg-label" />
            <div className="p-3 space-y-2">
              <div className="h-3 bg-groove rounded w-1/2" />
              <div className="h-4 bg-groove rounded" />
              <div className="h-4 bg-groove rounded w-3/4" />
              <div className="h-3 bg-groove rounded w-2/5 mt-1" />
              <div className="h-6 bg-wax/40 rounded w-1/3 mt-2" />
              <div className="h-7 bg-groove rounded mt-3" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
