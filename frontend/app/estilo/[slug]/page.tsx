import { prisma } from "@/lib/prisma";
import DiscoCard from "@/components/DiscoCard";
import SortBar from "@/components/SortBar";
import BackToTop from "@/components/BackToTop";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, cache } from "react";
import { truncateTitle, truncateDesc } from "@/lib/seo";
import { unstable_cache } from "next/cache";
import { slugifyStyle } from "@/lib/styleUtils";

export const revalidate = 3600; // safety-net; on-demand purge via revalidateTag("prices") fires first

// Same accent-normalization constants as the artist page SQL slug matching
const ACCENT_FROM = "áàâãäåéèêëíìîïóòôõöúùûüçñý";
const ACCENT_TO   = "aaaaaaeeeeiiiioooouuuucny";

type Sort = "deals" | "desconto" | "menor-preco" | "maior-preco" | "avaliados" | "az";

type SerializedEstiloData = {
  canonical: string;
  discos: {
    id: string;
    titulo: string;
    artista: string;
    slug: string;
    imgUrl: string | null;
    url: string;
    estilo: string | null;
    rating: string | null;
    precoAtual: number;
    mediaPreco: number;
    desconto: number;
    sparkline: number[];
    dealScore: number | null;
    confidenceLevel: string | null;
    lastCrawledAt: string | null;
  }[];
};

/**
 * Fetches all discos tagged with a given style slug.
 * Finds the canonical tag display name by matching slugified tags against all
 * distinct values in lastfm_tags, then queries discos using that exact tag string.
 * Wrapped with React cache() so generateMetadata and the page share one result.
 */
const _getEstiloPageData = unstable_cache(
  async (slug: string): Promise<SerializedEstiloData | null> => {
    const t0 = Date.now();
    // Find the canonical display name by applying the same slug transform in SQL
    const canonicalRow = await prisma.$queryRaw<{ tag: string }[]>`
      WITH tags AS (
        SELECT DISTINCT unnest(string_to_array(lastfm_tags, ', ')) AS tag
        FROM "Disco"
        WHERE lastfm_tags IS NOT NULL AND lastfm_tags != ''
      )
      SELECT tag FROM tags
      WHERE regexp_replace(
              regexp_replace(
                translate(lower(tag), ${ACCENT_FROM}, ${ACCENT_TO}),
                '[^a-z0-9]+', '-', 'g'
              ),
              '^-+|-+$', '', 'g'
            ) = ${slug}
      LIMIT 1
    `;

    const t1 = Date.now();
    console.log(`[PERF estilo/${slug}] canonicalRow: ${t1 - t0}ms`);

    if (canonicalRow.length === 0) return null;
    const canonical = canonicalRow[0].tag;

    const rows = await prisma.$queryRaw<{
      id: string;
      titulo: string;
      artista: string;
      slug: string;
      imgUrl: string | null;
      url: string;
      estilo: string | null;
      rating: string | null;
      dealScore: number | null;
      confidenceLevel: string | null;
      lastCrawledAt: Date | null;
      precoAtual: number;
      mediaPreco: number;
      desconto: number;
      sparkline: unknown;
    }[]>`
      WITH candidates AS (
        SELECT id, titulo, artista, slug, "imgUrl", url, estilo, rating,
               deal_score, confidence_level, last_crawled_at, avg_30d
        FROM "Disco"
        WHERE LOWER(${canonical}) = ANY(string_to_array(LOWER(lastfm_tags), ', '))
          AND disponivel = TRUE
          AND price_count >= 5
      )
      SELECT
        c.id,
        c.titulo,
        c.artista,
        c.slug,
        c."imgUrl",
        c.url,
        c.estilo,
        c.rating::text,
        c.deal_score       AS "dealScore",
        c.confidence_level AS "confidenceLevel",
        c.last_crawled_at  AS "lastCrawledAt",
        hp_latest.preco                                        AS "precoAtual",
        COALESCE(c.avg_30d::float, hp_latest.preco)           AS "mediaPreco",
        CASE
          WHEN COALESCE(c.avg_30d::float, 0) > 0
          THEN (COALESCE(c.avg_30d::float, hp_latest.preco) - hp_latest.preco)
               / COALESCE(c.avg_30d::float, hp_latest.preco)
          ELSE 0
        END AS desconto,
        (
          SELECT COALESCE(
            json_agg(sp."precoBrl"::float ORDER BY sp."capturadoEm"),
            '[]'::json
          )
          FROM (
            SELECT "precoBrl", "capturadoEm"
            FROM "HistoricoPreco"
            WHERE "discoId" = c.id
              AND "capturadoEm" >= NOW() - INTERVAL '30 days'
            ORDER BY "capturadoEm" ASC
            LIMIT 10
          ) sp
        ) AS sparkline
      FROM candidates c
      INNER JOIN LATERAL (
        SELECT "precoBrl"::float AS preco
        FROM "HistoricoPreco"
        WHERE "discoId" = c.id
        ORDER BY "capturadoEm" DESC
        LIMIT 1
      ) hp_latest ON true
      ORDER BY c.deal_score DESC NULLS LAST, desconto DESC NULLS LAST
      LIMIT 96
    `;

    const t2 = Date.now();
    console.log(`[PERF estilo/${slug}] mainQuery: ${t2 - t1}ms (${rows.length} discos) | total: ${t2 - t0}ms`);

    return {
      canonical,
      discos: rows.map((row) => {
        let sparkline: number[] = [];
        if (Array.isArray(row.sparkline)) {
          sparkline = (row.sparkline as unknown[]).map(Number).filter((n) => !isNaN(n));
        } else if (typeof row.sparkline === "string") {
          try {
            sparkline = (JSON.parse(row.sparkline) as unknown[])
              .map(Number)
              .filter((n) => !isNaN(n));
          } catch {
            sparkline = [];
          }
        }
        return {
          id: row.id,
          titulo: row.titulo,
          artista: row.artista,
          slug: row.slug,
          imgUrl: row.imgUrl,
          url: row.url,
          estilo: row.estilo,
          rating: row.rating ?? null,
          precoAtual: Number(row.precoAtual),
          mediaPreco: Number(row.mediaPreco),
          desconto: Number(row.desconto),
          sparkline,
          dealScore:
            row.dealScore !== null && row.dealScore !== undefined
              ? Number(row.dealScore)
              : null,
          confidenceLevel: row.confidenceLevel ?? null,
          lastCrawledAt: row.lastCrawledAt
            ? new Date(row.lastCrawledAt).toISOString()
            : null,
        };
      }),
    };
  },
  ["estilo-page"],
  { tags: ["prices"] }
);

const getEstiloPageData = cache(_getEstiloPageData);

type RelatedEstilo = { tag: string; slug: string };

const _getRelatedEstilos = unstable_cache(
  async (canonical: string): Promise<RelatedEstilo[]> => {
    const rows = await prisma.$queryRaw<{ tag: string }[]>`
      WITH current_discos AS (
        SELECT id FROM "Disco"
        WHERE disponivel = TRUE
          AND LOWER(${canonical}) = ANY(string_to_array(LOWER(lastfm_tags), ', '))
      ),
      all_tags AS (
        SELECT tag, COUNT(DISTINCT id)::float AS total
        FROM (
          SELECT id, LOWER(unnest(string_to_array(lastfm_tags, ', '))) AS tag
          FROM "Disco"
          WHERE disponivel = TRUE
        ) t
        GROUP BY tag
      ),
      shared_tags AS (
        SELECT tag, COUNT(DISTINCT id)::float AS shared
        FROM (
          SELECT d.id, LOWER(unnest(string_to_array(d.lastfm_tags, ', '))) AS tag
          FROM "Disco" d
          INNER JOIN current_discos cd ON cd.id = d.id
          WHERE d.disponivel = TRUE
        ) t
        GROUP BY tag
      ),
      current_size AS (SELECT COUNT(*)::float AS cnt FROM current_discos)
      SELECT s.tag
      FROM shared_tags s
      JOIN all_tags a ON a.tag = s.tag
      CROSS JOIN current_size cs
      WHERE s.tag != LOWER(${canonical})
        AND s.shared > 0
      ORDER BY s.shared / (cs.cnt + a.total - s.shared) DESC
      LIMIT 10
    `;
    console.log(`[PERF estilo-related/${canonical}] ${rows.length} related styles`);
    return rows.map((r) => ({ tag: r.tag, slug: slugifyStyle(r.tag) }));
  },
  ["estilo-related"],
  { tags: ["prices"] }
);

const getRelatedEstilos = cache(_getRelatedEstilos);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let data;
  try {
    data = await getEstiloPageData(slug);
  } catch {
    return {};
  }
  if (!data) return {};
  const { canonical } = data;
  const displayName = canonical.replace(/\b\w/g, (c) => c.toUpperCase());
  const title = truncateTitle(`${displayName} — Discos em Promoção | Garimpa Vinil`);
  const description = truncateDesc(`Melhores ofertas de discos de ${displayName} em vinil: acompanhe o histórico de preços e encontre o disco certo pelo menor valor.`);
  const firstImage = data.discos.find((d) => d.imgUrl)?.imgUrl ?? null;
  return {
    title,
    description,
    alternates: { canonical: `/estilo/${slug}` },
    openGraph: {
      title,
      description,
      url: `/estilo/${slug}`,
      type: "website",
      ...(firstImage ? { images: [{ url: firstImage, alt: displayName }] } : {}),
    },
    twitter: {
      card: firstImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(firstImage ? { images: [firstImage] } : {}),
    },
  };
}

export default async function EstiloPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; precoMax?: string }>;
}) {
  const { slug } = await params;
  const { sort = "desconto", precoMax: precoMaxStr } = await searchParams;
  const precoMax =
    precoMaxStr !== undefined && precoMaxStr !== "" ? Number(precoMaxStr) : null;

  let data: SerializedEstiloData | null = null;
  try {
    data = await getEstiloPageData(slug);
  } catch (err) {
    console.error("[EstiloPage] getEstiloPageData failed for slug=%s", slug);
    if (process.env.NODE_ENV === "development") console.error(err);
    return (
      <main className="max-w-7xl mx-auto px-4 py-24 text-center">
        <p className="font-display text-parchment text-lg font-semibold mb-2">
          Erro ao carregar página de estilo
        </p>
        <p className="text-dust text-sm">Tente novamente em alguns instantes.</p>
      </main>
    );
  }
  if (!data) notFound();

  const { canonical, discos } = data;
  const displayName = canonical.replace(/\b\w/g, (c) => c.toUpperCase());

  let relatedEstilos: RelatedEstilo[] = [];
  try {
    relatedEstilos = await getRelatedEstilos(canonical);
  } catch (err) {
    console.error("[EstiloPage] getRelatedEstilos failed for canonical=%s", canonical, err);
  }

  const DEAL_STALE_MS = 4 * 60 * 60 * 1000;

  const discosProcessados = discos.map((disco) => {
    const crawledAt = disco.lastCrawledAt
      ? new Date(disco.lastCrawledAt).getTime()
      : null;
    const dealIsStale =
      crawledAt === null || Date.now() - crawledAt > DEAL_STALE_MS;
    const dealScore =
      disco.dealScore !== null && !dealIsStale ? disco.dealScore : null;

    return {
      ...disco,
      rating: disco.rating ? Number(disco.rating) : null,
      emPromocao: dealScore !== null,
      dealScore,
    };
  });

  const filtrados =
    precoMax !== null && !isNaN(precoMax)
      ? discosProcessados.filter((d) => d.precoAtual <= precoMax)
      : discosProcessados;

  const sorted = [...filtrados].sort((a, b) => {
    switch (sort as Sort) {
      case "deals":
        return (b.dealScore ?? -1) - (a.dealScore ?? -1) || b.desconto - a.desconto;
      case "menor-preco":
        return a.precoAtual - b.precoAtual;
      case "maior-preco":
        return b.precoAtual - a.precoAtual;
      case "avaliados":
        return (b.rating ?? 0) - (a.rating ?? 0);
      case "az":
        return a.titulo.localeCompare(b.titulo, "pt-BR");
      case "desconto":
      default:
        return b.desconto - a.desconto;
    }
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vinyl-tracker.vercel.app";

  const breadcrumbJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${siteUrl}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: displayName,
        item: `${siteUrl}/estilo/${slug}`,
      },
    ],
  });

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      <nav className="flex items-center gap-1.5 text-sm text-dust mb-6 flex-wrap">
        <Link href="/" className="hover:text-cream transition-colors">
          Início
        </Link>
        <span>›</span>
        <span className="text-parchment">{displayName}</span>
      </nav>

      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-cream">
          {displayName}
        </h1>
        <p className="mt-1 text-dust text-sm">
          {sorted.length}{" "}
          {sorted.length === 1 ? "disco" : "discos"}
          {precoMax !== null && !isNaN(precoMax)
            ? ` até R$ ${precoMax.toLocaleString("pt-BR")}`
            : " rastreados"}
        </p>
      </header>

      <div className="mb-4">
        <Suspense>
          <SortBar />
        </Suspense>
      </div>

      {sorted.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {sorted.map((disco, index) => (
            <DiscoCard key={disco.id} disco={disco} priority={index < 4} />
          ))}
        </div>
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
          <p className="text-dust text-sm">Tente ajustar os filtros.</p>
        </div>
      )}


      {relatedEstilos.length > 0 && (
        <section className="mt-12 pt-8 border-t border-groove">
          <h2 className="text-dust text-xs font-semibold uppercase tracking-widest mb-3">
            Outros estilos
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {relatedEstilos.map((e) => (
              <Link
                key={e.slug}
                href={`/estilo/${e.slug}`}
                className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-groove border border-wax/40 text-dust hover:text-parchment hover:border-wax/70 transition-colors"
              >
                {e.tag.replace(/\b\w/g, (c) => c.toUpperCase())}
              </Link>
            ))}
          </div>
        </section>
      )}

      <BackToTop />
    </main>
  );
}
