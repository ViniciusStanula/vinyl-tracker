import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import DiscoCard from "@/components/DiscoCard";
import Pagination from "@/components/Pagination";
import SortBar from "@/components/SortBar";
import BackToTop from "@/components/BackToTop";
import StyleTags from "@/components/StyleTags";
import Link from "next/link";
import { notFound } from "next/navigation";
import { slugifyArtist } from "@/lib/slugify";
import { truncateTitle, truncateDesc } from "@/lib/seo";
import { getTopStyles } from "@/lib/styleUtils";
import type { ProcessedDisco } from "@/lib/queryDiscos";
import { Suspense, cache } from "react";
import { unstable_cache } from "next/cache";

export const revalidate = 3600; // safety-net; on-demand purge via revalidateTag("prices") fires first

// Covers the full set of accented characters produced by slugifyArtist()'s
// NFD normalization for Portuguese, Spanish, French, German, and other common
// artist name origins. translate() is a built-in PostgreSQL function that
// requires no extension, unlike unaccent().
const ACCENT_FROM = "áàâãäåéèêëíìîïóòôõöúùûüçñý";
const ACCENT_TO   = "aaaaaaeeeeiiiioooouuuucny";

const PAGE_SIZE = 24;

type Sort = "deals" | "desconto" | "menor-preco" | "maior-preco" | "avaliados" | "az";

function buildOrderBy(sort: string): Prisma.Sql {
  switch (sort as Sort) {
    case "menor-preco": return Prisma.sql`"precoAtual" ASC`;
    case "maior-preco": return Prisma.sql`"precoAtual" DESC`;
    case "avaliados":   return Prisma.sql`COALESCE(rating::numeric, 0) DESC`;
    case "az":          return Prisma.sql`titulo ASC`;
    case "deals":       return Prisma.sql`deal_score DESC NULLS LAST, desconto DESC NULLS LAST`;
    case "desconto":
    default:            return Prisma.sql`desconto DESC NULLS LAST, COALESCE("reviewCount", 0) DESC`;
  }
}

type ArtistaRow = {
  id: string;
  titulo: string;
  artista: string;
  slug: string;
  estilo: string | null;
  imgUrl: string | null;
  url: string;
  rating: string | null;
  reviewCount: string | null;
  precoAtual: string;
  mediaPreco: string;
  totalPrecos: string;
  desconto: string;
  sparkline: unknown;
  dealScore: string | null;
  confidenceLevel: string | null;
  historyDays: string | null;
  lastCrawledAt: Date | null;
  lastfmTags: string | null;
};

type ArtistaPageData = {
  canonical: string;
  items: ProcessedDisco[];
  total: number;
  totalPages: number;
  topStyles: string[];
};

const _getArtistaPageData = unstable_cache(
  async (
    slug: string,
    page: number,
    sort: string,
    precoMax: number | null,
  ): Promise<ArtistaPageData | null> => {
    const t0 = Date.now();
    // Pre-filter at the DB level using a SQL slug approximation so we transfer
    // only candidates instead of the full artist table. Two expressions cover:
    //   1. Regular names: lower(regexp_replace(artista, '[^a-z0-9]+', '-', 'g'))
    //   2. Inverted "LAST,FIRST" names: swap parts before slugifying
    // The JS slugifyArtist() filter below is the exact match safety-net for
    // edge cases (accent stripping via NFD that SQL doesn't reproduce exactly).
    // Inlined as Prisma.raw() (not bound parameters) so PostgreSQL can match
    // idx_disco_artista_slug_expr and idx_disco_artista_slug_inverted exactly.
    // Safe: these are hardcoded constants, not user input.
    const AF = Prisma.raw(`'${ACCENT_FROM}'`);
    const AT = Prisma.raw(`'${ACCENT_TO}'`);

    const candidates = await prisma.$queryRaw<{ artista: string }[]>`
      SELECT DISTINCT artista FROM "Disco"
      WHERE left(
              regexp_replace(
                regexp_replace(translate(lower(artista), ${AF}, ${AT}), '[^a-z0-9]+', '-', 'g'),
                '^-+|-+$', '', 'g'
              ), 60) = ${slug}
         OR left(
              regexp_replace(
                regexp_replace(
                  translate(
                    lower(trim(split_part(artista, ',', 2)) || ' ' || trim(split_part(artista, ',', 1))),
                    ${AF}, ${AT}
                  ),
                  '[^a-z0-9]+', '-', 'g'
                ),
                '^-+|-+$', '', 'g'
              ), 60) = ${slug}
    `;

    const t1 = Date.now();
    console.log(`[PERF artista/${slug}] candidates: ${t1 - t0}ms`);

    const variants = candidates
      .map((r) => r.artista)
      .filter((a) => slugifyArtist(a) === slug);

    if (variants.length === 0) return null;

    // Pick the cleanest name: prefer no comma, then shortest (usually proper-cased)
    const canonical = variants.slice().sort((a, b) => {
      const aScore = (a.includes(",") ? 1 : 0) + (a === a.toUpperCase() ? 1 : 0);
      const bScore = (b.includes(",") ? 1 : 0) + (b === b.toUpperCase() ? 1 : 0);
      return aScore - bScore || a.length - b.length;
    })[0];

    const order = buildOrderBy(sort);
    const offset = (page - 1) * PAGE_SIZE;
    const wherePrecoMax =
      precoMax !== null && !isNaN(precoMax)
        ? Prisma.sql`AND hp_latest."precoBrl" <= ${precoMax}`
        : Prisma.sql``;

    // COUNT skips the HistoricoPreco LATERAL when there is no price-max filter
    const countQuery =
      precoMax !== null && !isNaN(precoMax)
        ? prisma.$queryRaw<[{ total: bigint }]>`
            SELECT COUNT(*) AS total
            FROM   "Disco" d
            INNER JOIN LATERAL (
              SELECT "precoBrl"
              FROM   "HistoricoPreco"
              WHERE  "discoId" = d.id AND "precoBrl" >= 30
              ORDER  BY "capturadoEm" DESC LIMIT 1
            ) hp_latest ON true
            WHERE  d.artista = ANY(${variants})
              AND  d.disponivel = TRUE
              AND  d.price_count >= 5
              AND  hp_latest."precoBrl" <= ${precoMax}
          `
        : prisma.$queryRaw<[{ total: bigint }]>`
            SELECT COUNT(*) AS total
            FROM   "Disco" d
            WHERE  d.artista = ANY(${variants})
              AND  d.disponivel = TRUE
              AND  d.price_count >= 5
          `;

    // Fetch all lastfm_tags for this artist to compute stable topStyles across pages
    const tagsQuery = prisma.$queryRaw<{ lastfmTags: string | null }[]>`
      SELECT lastfm_tags AS "lastfmTags"
      FROM   "Disco"
      WHERE  artista = ANY(${variants})
        AND  disponivel = TRUE
        AND  price_count >= 5
        AND  lastfm_tags IS NOT NULL AND lastfm_tags != ''
    `;

    const mainQuery = prisma.$queryRaw<ArtistaRow[]>`
      WITH base AS (
        SELECT
          d.id,
          d.titulo,
          d.artista,
          d.slug,
          d.estilo,
          d."imgUrl",
          d.url,
          d.rating,
          d."reviewCount",
          d.deal_score        AS "dealScore",
          d.confidence_level  AS "confidenceLevel",
          d.history_days      AS "historyDays",
          d.last_crawled_at   AS "lastCrawledAt",
          d.lastfm_tags       AS "lastfmTags",
          hp_latest."precoBrl"                              AS "precoAtual",
          COALESCE(d.avg_30d::float, hp_latest."precoBrl")  AS "mediaPreco",
          d.price_count::INTEGER                            AS "totalPrecos",
          (
            SELECT COALESCE(
              json_agg(sp."precoBrl"::float ORDER BY sp."capturadoEm"),
              '[]'::json
            )
            FROM (
              SELECT "precoBrl", "capturadoEm"
              FROM   "HistoricoPreco"
              WHERE  "discoId" = d.id
                AND  "capturadoEm" >= NOW() - INTERVAL '30 days'
                AND  "precoBrl" >= 30
              ORDER  BY "capturadoEm" DESC
              LIMIT  10
            ) sp
          ) AS sparkline
        FROM   "Disco" d
        INNER JOIN LATERAL (
          SELECT "precoBrl"
          FROM   "HistoricoPreco"
          WHERE  "discoId" = d.id AND "precoBrl" >= 30
          ORDER  BY "capturadoEm" DESC LIMIT 1
        ) hp_latest ON true
        WHERE  d.artista = ANY(${variants})
          AND  d.disponivel = TRUE
          AND  d.price_count >= 5
          ${wherePrecoMax}
      )
      SELECT
        *,
        CASE WHEN "mediaPreco" > 0
          THEN ("mediaPreco" - "precoAtual") / "mediaPreco"
          ELSE 0
        END AS desconto
      FROM  base
      ORDER BY ${order}
      LIMIT  ${PAGE_SIZE}
      OFFSET ${offset}
    `;

    const [countResult, rows, tagsRows] = await Promise.all([
      countQuery,
      mainQuery,
      tagsQuery,
    ]);

    const t2 = Date.now();
    console.log(`[PERF artista/${slug}] count+query+tags (parallel): ${t2 - t1}ms | total: ${t2 - t0}ms`);

    const total = Number(countResult[0].total);
    if (total === 0) return null;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const topStyles = getTopStyles(tagsRows.map((r) => r.lastfmTags), 5, canonical);

    const DEAL_STALE_MS = 4 * 60 * 60 * 1000;

    const items = rows.flatMap((row): ProcessedDisco[] => {
      const precoAtual = Number(row.precoAtual);
      const mediaPreco = Number(row.mediaPreco);
      const desconto   = Number(row.desconto);

      if (isNaN(precoAtual) || isNaN(mediaPreco) || isNaN(desconto)) {
        // eslint-disable-next-line no-console
        console.warn("[artista/%s] NaN numeric field for disco id=%s — skipping", slug, row.id);
        return [];
      }

      let sparkline: number[] = [];
      if (Array.isArray(row.sparkline)) {
        sparkline = (row.sparkline as unknown[]).map(Number).filter((n) => !isNaN(n));
      } else if (typeof row.sparkline === "string") {
        try {
          sparkline = (JSON.parse(row.sparkline) as unknown[]).map(Number).filter((n) => !isNaN(n));
        } catch {
          sparkline = [];
        }
      }

      const rawDealScore =
        row.dealScore !== null && row.dealScore !== undefined
          ? Number(row.dealScore)
          : null;
      const crawledAt = row.lastCrawledAt ? new Date(row.lastCrawledAt).getTime() : null;
      const dealIsStale = crawledAt === null || Date.now() - crawledAt > DEAL_STALE_MS;
      const dealScore = rawDealScore !== null && !dealIsStale ? rawDealScore : null;

      return [{
        id:              row.id,
        slug:            row.slug,
        titulo:          row.titulo,
        artista:         row.artista,
        estilo:          row.estilo,
        imgUrl:          row.imgUrl,
        url:             row.url,
        rating:          row.rating !== null && row.rating !== undefined ? Number(row.rating) : null,
        reviewCount:     row.reviewCount !== null && row.reviewCount !== undefined ? Number(row.reviewCount) : null,
        precoAtual,
        mediaPreco,
        emPromocao:      dealScore !== null,
        desconto,
        sparkline,
        dealScore,
        confidenceLevel: row.confidenceLevel ?? null,
        historyDays:     row.historyDays !== null && row.historyDays !== undefined ? Number(row.historyDays) : null,
        lastfmTags:      row.lastfmTags ?? null,
      }];
    });

    return { canonical, items, total, totalPages, topStyles };
  },
  ["artista-page"],
  { tags: ["prices"] }
);

const getArtistaPageData = cache(_getArtistaPageData);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let data;
  try {
    data = await getArtistaPageData(slug, 1, "desconto", null);
  } catch {
    return {};
  }
  if (!data) return {};
  const { canonical } = data;
  const title = truncateTitle(`${canonical} — Discos em Promoção | Garimpa Vinil`);
  const description = truncateDesc(`Melhores ofertas de ${canonical} em vinil: acompanhe o histórico de preços e encontre o disco certo pelo menor valor.`);
  const firstImage = data.items.find((d) => d.imgUrl)?.imgUrl ?? null;
  return {
    title,
    description,
    alternates: { canonical: `/artista/${slug}` },
    openGraph: {
      title,
      description,
      url: `/artista/${slug}`,
      type: "website",
      ...(firstImage ? { images: [{ url: firstImage, alt: canonical }] } : {}),
    },
    twitter: {
      card: firstImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(firstImage ? { images: [firstImage] } : {}),
    },
  };
}

export default async function ArtistaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; precoMax?: string; page?: string }>;
}) {
  const { slug } = await params;
  const { sort = "desconto", precoMax: precoMaxStr, page: pageStr } = await searchParams;
  const precoMax =
    precoMaxStr !== undefined && precoMaxStr !== "" ? Number(precoMaxStr) : null;
  const currentPage = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);

  let data: ArtistaPageData | null = null;
  try {
    data = await getArtistaPageData(slug, currentPage, sort, precoMax);
  } catch (err) {
    console.error("[ArtistaPage] getArtistaPageData failed for slug=%s", slug);
    if (process.env.NODE_ENV === "development") console.error(err);
    return (
      <main className="max-w-7xl mx-auto px-4 py-24 text-center">
        <p className="font-display text-parchment text-lg font-semibold mb-2">
          Erro ao carregar página do artista
        </p>
        <p className="text-dust text-sm">Tente novamente em alguns instantes.</p>
      </main>
    );
  }
  if (!data) notFound();

  const { canonical: artista, items, total, totalPages, topStyles } = data;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vinyl-tracker.vercel.app";

  const breadcrumbJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${siteUrl}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: artista,
        item: `${siteUrl}/artista/${slug}`,
      },
    ],
  });

  const musicArtistJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "MusicArtist",
    name: artista,
    url: `${siteUrl}/artista/${slug}`,
    ...(topStyles.length > 0 ? { genre: topStyles } : {}),
  });

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: musicArtistJsonLd }} />
      <nav className="flex items-center gap-1.5 text-sm text-dust mb-6 flex-wrap">
        <Link href="/" className="hover:text-cream transition-colors">
          Início
        </Link>
        <span>›</span>
        <span className="text-parchment">{artista}</span>
      </nav>

      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-cream">
          {artista}
        </h1>
        <p className="mt-1 text-dust text-sm">
          {total}{" "}
          {total === 1 ? "disco" : "discos"}
          {precoMax !== null && !isNaN(precoMax)
            ? ` até R$ ${precoMax.toLocaleString("pt-BR")}`
            : " rastreados"}
        </p>
        <StyleTags tags={topStyles} />
      </header>

      <div className="mb-4">
        <Suspense>
          <SortBar />
        </Suspense>
      </div>

      {items.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {items.map((disco, index) => (
              <DiscoCard key={disco.id} disco={disco} priority={index < 4} />
            ))}
          </div>
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              searchParams={{ sort: sort !== "desconto" ? sort : undefined, precoMax: precoMaxStr }}
              basePath={`/artista/${slug}`}
            />
          )}
        </>
      ) : (
        <div className="text-center py-24 text-dust">
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
          <p className="text-dust text-sm mb-4">Tente ajustar os filtros.</p>
          {(precoMax !== null || sort !== "desconto") && (
            <Link
              href={`/artista/${slug}`}
              className="inline-flex items-center gap-2 bg-groove hover:bg-wax text-parchment text-sm px-5 py-2 rounded-full transition-colors border border-wax/60"
            >
              Limpar filtros
            </Link>
          )}
        </div>
      )}

      <BackToTop />
    </main>
  );
}
