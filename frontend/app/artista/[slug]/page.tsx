import { prisma } from "@/lib/prisma";
import DiscoCard from "@/components/DiscoCard";
import SortBar from "@/components/SortBar";
import BackToTop from "@/components/BackToTop";
import Link from "next/link";
import { notFound } from "next/navigation";
import { slugifyArtist } from "@/lib/slugify";
import { Suspense, cache } from "react";

export const dynamic = "force-dynamic";

type Sort = "desconto" | "menor-preco" | "maior-preco" | "avaliados" | "az";

/**
 * Returns all distinct artist name variants that map to the given slug,
 * plus a canonical display name (the one that looks cleanest — no commas,
 * prefer mixed-case over ALL CAPS).
 *
 * Wrapped with React cache() so that generateMetadata and the page component
 * share a single DB query per request instead of issuing two identical ones.
 */
const resolveArtista = cache(async function resolveArtista(
  slug: string
): Promise<{ canonical: string; variants: string[] } | null> {
  const todos = await prisma.disco.findMany({
    select: { artista: true },
    distinct: ["artista"],
  });
  const variants = todos
    .map((a) => a.artista)
    .filter((a) => slugifyArtist(a) === slug);

  if (variants.length === 0) return null;

  // Pick the cleanest name: prefer no comma, then shortest (usually proper-cased)
  const canonical = variants.sort((a, b) => {
    const aScore = (a.includes(",") ? 1 : 0) + (a === a.toUpperCase() ? 1 : 0);
    const bScore = (b.includes(",") ? 1 : 0) + (b === b.toUpperCase() ? 1 : 0);
    return aScore - bScore || a.length - b.length;
  })[0];

  return { canonical, variants };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resolved = await resolveArtista(slug);
  if (!resolved) return {};
  const { canonical } = resolved;
  return {
    title: `${canonical} — Discos em Promoção | Garimpa Vinil`,
    description: `Melhores ofertas de ${canonical} em vinil: acompanhe o histórico de preços e encontre o disco certo pelo menor valor.`,
  };
}

export default async function ArtistaPage({
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

  const resolved = await resolveArtista(slug);
  if (!resolved) notFound();
  const { canonical: artista, variants: artistaVariants } = resolved;

  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  const discos = await prisma.disco.findMany({
    where: { artista: { in: artistaVariants } },
    include: {
      precos: {
        where: { capturadoEm: { gte: oneYearAgo } },
        orderBy: { capturadoEm: "desc" },
        take: 60,
      },
    },
  });

  if (discos.length === 0) notFound();

  // Fetch deal_score and confidence_level for these discos.
  // These columns live outside the Prisma schema (managed by the crawler),
  // so a targeted raw query is the lightest way to pull them in.
  const discoIds = discos.map((d) => d.id);
  type DealMeta = {
    id: string;
    deal_score: number | null;
    confidence_level: string | null;
    last_crawled_at: Date | null;
  };
  const dealMetaRows = await prisma.$queryRaw<DealMeta[]>`
    SELECT id::text, deal_score, confidence_level, last_crawled_at
    FROM "Disco"
    WHERE id::text = ANY(${discoIds})
  `;
  const dealMeta = Object.fromEntries(dealMetaRows.map((r) => [r.id, r]));

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const discosProcessados = discos.map((disco) => {
    const precos = disco.precos.map((p) => Number(p.precoBrl));
    const precoAtual = precos[0] ?? 0;
    const media =
      precos.length > 0
        ? precos.reduce((a, b) => a + b, 0) / precos.length
        : precoAtual;
    const desconto = media > 0 ? (media - precoAtual) / media : 0;

    // Build sparkline from last 10 price points within the 30-day window
    const sparkline = [...disco.precos]
      .filter((p) => p.capturadoEm >= thirtyDaysAgo)
      .sort((a, b) => a.capturadoEm.getTime() - b.capturadoEm.getTime())
      .slice(-10)
      .map((p) => Number(p.precoBrl));

    const meta = dealMeta[disco.id];
    const rawDealScore = meta?.deal_score !== null && meta?.deal_score !== undefined
      ? Number(meta.deal_score)
      : null;

    const DEAL_STALE_MS = 4 * 60 * 60 * 1000;
    const crawledAt = meta?.last_crawled_at ? new Date(meta.last_crawled_at).getTime() : null;
    const dealIsStale = crawledAt === null || Date.now() - crawledAt > DEAL_STALE_MS;
    const dealScore = rawDealScore !== null && !dealIsStale ? rawDealScore : null;

    return {
      ...disco,
      rating:          disco.rating ? Number(disco.rating) : null,
      precoAtual,
      mediaPreco:      media,
      // emPromocao mirrors the scorer: a product is on promotion iff deal_score is set
      emPromocao:      dealScore !== null,
      desconto,
      sparkline,
      dealScore,
      confidenceLevel: meta?.confidence_level ?? null,
    };
  });

  // Apply price filter
  const filtrados =
    precoMax !== null && !isNaN(precoMax)
      ? discosProcessados.filter((d) => d.precoAtual <= precoMax)
      : discosProcessados;

  // Apply sort
  const sorted = [...filtrados].sort((a, b) => {
    switch (sort as Sort) {
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

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <nav className="flex items-center gap-1.5 text-sm text-zinc-500 mb-6 flex-wrap">
        <Link href="/" className="hover:text-zinc-300 transition-colors">
          Início
        </Link>
        <span>›</span>
        <span className="text-zinc-400">{artista}</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-3xl font-bold text-zinc-100">{artista}</h1>
        <p className="mt-1 text-zinc-500 text-sm">
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
        <div className="text-center py-24 text-zinc-600">
          <p className="text-5xl mb-4">🎵</p>
          <p className="text-zinc-400 text-lg font-medium mb-2">
            Nenhum disco encontrado
          </p>
          <p className="text-zinc-600 text-sm">
            Tente ajustar os filtros.
          </p>
        </div>
      )}

      <BackToTop />
    </main>
  );
}
