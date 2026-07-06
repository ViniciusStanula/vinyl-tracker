import { queryDiscosWithCache } from "@/lib/queryDiscos";
import { getDiscoCount } from "@/lib/db/home";
import { PEER_ORIGIN } from "@/lib/hreflang";
import { formatDiscoCount } from "@/lib/utils/formatters";
import SortBar from "@/components/SortBar";
import InfiniteGrid from "@/components/InfiniteGrid";
import BackToTop from "@/components/BackToTop";
import Link from "next/link";
import { Suspense } from "react";

const HIDE_PRICE_HISTORY = process.env.NEXT_PUBLIC_HIDE_PRICE_HISTORY !== "false";

export const revalidate = 14400;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; artista?: string; page?: string; precoMax?: string }>;
}) {
  const { q, page } = await searchParams;
  if (q?.trim()) {
    return { title: "Catálogo de Discos de Vinil — Garimpa Vinil", robots: { index: false, follow: true } };
  }
  const pageNum = page !== undefined ? parseInt(page, 10) : 1;
  if (pageNum > 1) {
    return {
      title: "Catálogo de Discos de Vinil — Garimpa Vinil",
      robots: { index: false, follow: true },
      alternates: { canonical: `/disco?page=${pageNum}` },
    };
  }
  let count = 0;
  try {
    count = await getDiscoCount();
  } catch {
    // DB unavailable — fall back to generic description
  }
  const description = count > 0
    ? `Catálogo com +${count.toLocaleString("pt-BR")} discos de vinil na Amazon Brasil. Navegue todos os títulos e filtre por preço, artista, estilo e ordenação.`
    : metadata.description;
  return {
    ...metadata,
    description,
    openGraph: { ...metadata.openGraph, description },
    twitter: { ...metadata.twitter, description },
  };
}

// Title/description target "catálogo completo" intent — the home page owns
// the "melhores ofertas" intent. Keeps the two pages from competing.
const metadata = {
  title: "Catálogo de Discos de Vinil — Garimpa Vinil",
  description:
    "Catálogo completo de discos de vinil na Amazon Brasil. Navegue todos os títulos e filtre por preço, artista, estilo e ordenação.",
  alternates: {
    canonical: "/disco",
    languages: {
      "pt-BR": "/disco",
      "en-US": `${PEER_ORIGIN}/records`,
      "x-default": `${PEER_ORIGIN}/records`,
    },
  },
  openGraph: {
    title: "Catálogo de Discos de Vinil — Garimpa Vinil",
    description:
      "Catálogo completo de discos de vinil na Amazon Brasil. Navegue todos os títulos e filtre por preço, artista, estilo e ordenação.",
    url: "/disco",
    type: "website",
    images: ["/og-default.png"],
  },
  twitter: {
    card: "summary",
    title: "Catálogo de Discos de Vinil — Garimpa Vinil",
    description:
      "Catálogo completo de discos de vinil na Amazon Brasil. Navegue todos os títulos e filtre por preço, artista, estilo e ordenação.",
  },
};

export default async function DiscosPage({
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      <h1 className="font-display text-3xl font-black text-cream mb-2 [text-wrap:balance]">
        Catálogo de Discos de Vinil
      </h1>

      <p className="text-dust text-sm leading-relaxed mb-4 max-w-2xl">
        Navegue o catálogo completo de discos de vinil disponíveis na Amazon
        Brasil, com preços acompanhados regularmente. Use a busca e os filtros
        para encontrar artistas, estilos e faixas de preço — ou explore os{" "}
        <Link href="/guias" className="text-parchment hover:text-gold underline underline-offset-2 transition-colors">
          guias de vinil
        </Link>{" "}
        para descobrir novos álbuns e{" "}
        <Link href="/guias/como-cuidar-de-discos-de-vinil" className="text-parchment hover:text-gold underline underline-offset-2 transition-colors">
          aprender a cuidar deles
        </Link>
        .
      </p>

      {/* ── Sort bar — sticky so filters stay in view while scrolling */}
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

      {/* ── Result count + grid stream in; static chrome above ships in the
             shell so the h1 and intro land inside <main> before the footer. */}
      <Suspense fallback={<DiscosResultsSkeleton />}>
        <DiscosResults
          searchTerm={searchTerm}
          sort={sort}
          artista={artista}
          precoMax={precoMax}
          page={page}
          q={q}
          precoMaxStr={precoMaxStr}
        />
      </Suspense>

      <BackToTop />
    </div>
  );
}

async function DiscosResults({
  searchTerm, sort, artista, precoMax, page, q, precoMaxStr,
}: {
  searchTerm: string;
  sort: string;
  artista?: string;
  precoMax: number | null;
  page: number;
  q?: string;
  precoMaxStr?: string;
}) {
  let items: Awaited<ReturnType<typeof queryDiscosWithCache>>["items"] = [];
  let total = 0, totalPages = 0;
  try {
    ({ items, total, totalPages } = await queryDiscosWithCache({ searchTerm, sort, artista, precoMax, page }));
  } catch {
    // DB unavailable — render empty state
  }

  const currentPage = Math.min(page, totalPages);

  return (
    <>
      {/* ── Result count + active filters ───────────────────────── */}
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
              href="/disco"
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
        />
      ) : (
        <section aria-label="Sem resultados" className="text-center py-24 text-dust">
          <div className="inline-block mb-5 opacity-40">
            <svg viewBox="0 0 64 64" fill="none" className="w-16 h-16 mx-auto">
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
            href="/disco"
            className="inline-flex items-center gap-2 bg-gold hover:bg-goldlit text-record font-bold text-sm px-6 py-2.5 rounded-full transition-colors"
          >
            Ver todos os discos
          </Link>
        </section>
      )}
    </>
  );
}

/* Fallback shown while DiscosResults streams — mirrors the loading.tsx grid. */
function DiscosResultsSkeleton() {
  return (
    <>
      <div className="h-4 w-36 bg-groove rounded animate-pulse mb-5" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="bg-sleeve border border-groove rounded-xl overflow-hidden animate-pulse"
          >
            <div className="aspect-square bg-label" />
            <div className="p-4 space-y-2">
              <div className="h-2.5 bg-groove rounded w-1/2" />
              <div className="h-3.5 bg-groove rounded" />
              <div className="h-3.5 bg-groove rounded w-3/4" />
              <div className="h-5 bg-wax/40 rounded w-1/3 mt-3" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
