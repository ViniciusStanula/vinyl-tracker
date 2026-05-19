import { queryDiscosWithCache } from "@/lib/queryDiscos";
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

export const revalidate = 1800;

export async function generateMetadata() {
  let count = 0;
  try {
    count = await getDiscoCount();
  } catch {
    // DB unavailable — fall back to generic description
  }
  const countStr = count > 0 ? `+${count.toLocaleString("pt-BR")} discos rastreados. ` : "";
  const description = `${countStr}Os melhores descontos em discos de vinil na Amazon Brasil. Histórico de preços atualizado a cada 2 horas.`;
  return {
    title: "Garimpa Vinil — Melhores ofertas em discos de vinil",
    description,
    alternates: { canonical: "/" },
    openGraph: {
      title: "Garimpa Vinil — Melhores ofertas em discos de vinil",
      description,
      url: "/",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Garimpa Vinil — Melhores ofertas em discos de vinil",
      description,
    },
  };
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vinyl-tracker.vercel.app";

const websiteJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Garimpa Vinil",
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
});

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

  // Fetch main grid and carousel in parallel
  let items: Awaited<ReturnType<typeof queryDiscosWithCache>>["items"] = [];
  let total = 0, totalPages = 0, carouselItems: Awaited<ReturnType<typeof queryCarouselDiscosWithCache>> = [];
  let count = 0;
  try {
    ([{ items, total, totalPages }, carouselItems, count] = await Promise.all([
      queryDiscosWithCache({ searchTerm, sort, artista, precoMax, page }),
      searchTerm || artista ? Promise.resolve([]) : queryCarouselDiscosWithCache(),
      getDiscoCount(),
    ]));
  } catch {
    // DB unavailable — render empty state
  }

  const currentPage = Math.min(page, totalPages);

  return (
    <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: websiteJsonLd }} />

      {/* ── Hero ────────────────────────────────────────────────── */}
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
            Curadoria Especializada
          </span>
          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-black leading-[0.95] mb-4">
            <span className="italic text-cream">O Garimpo do Vinil</span>
            <br />
            <span className="not-italic text-gold">Começa Aqui.</span>
          </h1>
          <p className="text-parchment text-sm sm:text-base max-w-md leading-relaxed mb-4">
            Monitoramos preços na Amazon Brasil para você nunca perder uma oferta imperdível. Histórico completo, atualizado a cada 2 horas.
          </p>
          {count > 0 && (
            <p className="text-dust text-xs font-medium tabular-nums mb-5 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              +{count.toLocaleString("pt-BR")} discos rastreados
              <span aria-hidden="true" className="opacity-40">·</span>
              Atualizado a cada 2 horas
            </p>
          )}
          <div className="flex gap-3 flex-wrap">
            <Link
              href="/disco"
              className="inline-flex items-center gap-2 bg-gold hover:bg-goldlit text-record font-bold text-sm px-6 py-3 rounded-xl transition-colors"
            >
              Ver Ofertas de Hoje
            </Link>
            <Link
              href="/sobre"
              className="inline-flex items-center gap-2 border border-wax text-cream hover:bg-groove text-sm px-6 py-3 rounded-xl transition-colors font-medium"
            >
              Saiba Mais
            </Link>
          </div>
        </div>
      </header>

      {/* ── Artistas mais Ouvidos carousel ──────────────────────── */}
      <ArtistasCarousel items={carouselItems} />

      {/* ── Sort bar ────────────────────────────────────────────── */}
      <div className="sticky top-[62px] z-40 mb-3 bg-record/95 backdrop-blur-md -mx-4 px-4 pt-2 pb-2">
        <Suspense>
          <SortBar />
        </Suspense>
      </div>

      {/* ── Deal badge legend ────────────────────────────────────── */}
      <p className="text-xs text-dust mb-4 leading-relaxed">
        <span className="text-gold font-semibold">✦ Melhor Preço</span> = menor preço registrado
        {" · "}
        <span className="text-deallit font-semibold">✓ Ótima Oferta</span> = abaixo da média histórica
        {" · "}
        Boa Oferta = com desconto ativo
      </p>

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

      {/* ── Telegram CTA ────────────────────────────────────────── */}
      <section className="mt-16 rounded-2xl bg-sleeve border border-groove px-6 py-10 relative overflow-hidden vinyl-grooves">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="min-w-0">
            <span className="text-gold text-[11px] font-bold uppercase tracking-[0.2em] block mb-3">
              Canal de Ofertas
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-black text-cream leading-tight mb-2 italic">
              Não perca nenhuma{" "}
              <span className="not-italic text-gold">oferta exclusiva.</span>
            </h2>
            <p className="text-parchment text-sm leading-relaxed max-w-md">
              Receba as melhores ofertas em vinil direto no Telegram. Atualizações diárias, sem spam.
            </p>
          </div>
          <a
            href="https://t.me/garimpavinil"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-[#29ABE2] hover:bg-[#1e8fc7] text-white font-bold text-sm px-7 py-4 rounded-xl transition-colors shrink-0 self-start sm:self-center"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0" aria-hidden="true">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            Entrar no Canal
          </a>
        </div>
      </section>

      <BackToTop />
    </main>
  );
}
