import { prisma } from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import GraficoPreco from "@/components/GraficoPreco";
import DiscoCard from "@/components/DiscoCard";
import BackToTop from "@/components/BackToTop";
import { slugifyArtist } from "@/lib/slugify";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const disco = await prisma.disco.findUnique({ where: { slug } });
  if (!disco) return {};
  return {
    title: `${disco.titulo} — ${disco.artista} em Vinil | Histórico de Preços`,
    description: `Compre ${disco.titulo} de ${disco.artista} pelo melhor preço. Veja o histórico de preços e as melhores ofertas disponíveis agora.`,
  };
}

type RelatedDeal = {
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
  sparkline: unknown;
  dealScore: number | null;
  confidenceLevel: string | null;
};

export default async function DiscoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  const disco = await prisma.disco.findUnique({
    where: { slug },
    include: {
      precos: {
        where: { capturadoEm: { gte: oneYearAgo } },
        orderBy: { capturadoEm: "asc" },
      },
    },
  });

  if (!disco) notFound();

  const valores = disco.precos.map((p) => Number(p.precoBrl));
  const precoAtual = valores.at(-1) ?? 0;
  const precoMin = valores.length ? Math.min(...valores) : precoAtual;
  const precoMax = valores.length ? Math.max(...valores) : precoAtual;
  const media =
    valores.length > 0
      ? valores.reduce((a, b) => a + b, 0) / valores.length
      : precoAtual;
  const desconto = media > 0 ? ((media - precoAtual) / media) * 100 : 0;

  // Record when the historical min and max occurred
  const minRecord =
    disco.precos.length > 0
      ? disco.precos.reduce((a, b) =>
          Number(a.precoBrl) <= Number(b.precoBrl) ? a : b
        )
      : null;
  const maxRecord =
    disco.precos.length > 0
      ? disco.precos.reduce((a, b) =>
          Number(a.precoBrl) >= Number(b.precoBrl) ? a : b
        )
      : null;

  // 3-state price status (evaluated in priority order)
  const statusPreco: "menor" | "aumento" | "estavel" | null =
    valores.length >= 2
      ? precoAtual <= precoMin
        ? "menor"
        : precoAtual > media * 1.03
        ? "aumento"
        : "estavel"
      : null;

  // Hours since last update
  const horasUpdate = Math.floor(
    (Date.now() - disco.updatedAt.getTime()) / (1000 * 60 * 60)
  );
  const updateLabel =
    horasUpdate === 0
      ? "menos de 1 hora"
      : horasUpdate === 1
      ? "1 hora"
      : `${horasUpdate} horas`;

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const BRT = "America/Sao_Paulo";

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("pt-BR", { timeZone: BRT });

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { timeZone: BRT, hour: "2-digit", minute: "2-digit" });

  const fmtDateTime = (d: Date) => `${fmtDate(d)}, ${fmtTime(d)}`;

  // Label for the "Atual" stat card — compare dates in BRT
  const dataAtual = disco.precos.at(-1)?.capturadoEm;
  const isHoje =
    dataAtual
      ? dataAtual.toLocaleDateString("pt-BR", { timeZone: BRT }) ===
        new Date().toLocaleDateString("pt-BR", { timeZone: BRT })
      : false;
  const dataAtualLabel = isHoje
    ? `Hoje, ${fmtTime(dataAtual!)}`
    : dataAtual
    ? fmtDateTime(dataAtual)
    : "—";

  const rating = disco.rating ? Number(disco.rating) : null;
  const stars = rating ? Math.round(rating) : 0;

  const chartPrecos = disco.precos.map((p) => ({
    data: p.capturadoEm.toLocaleDateString("pt-BR", {
      timeZone: BRT,
      day: "2-digit",
      month: "2-digit",
    }),
    dataFull: fmtDateTime(p.capturadoEm),
    valor: Number(p.precoBrl),
  }));

  // Price history displayed newest-first, with delta vs. previous capture
  const precosDisplay = [...disco.precos].reverse();

  // Related deals — 4 other records with an active deal score.
  // Uses deal_score IS NOT NULL so the query is consistent with the scorer's
  // multi-window logic rather than re-implementing a weaker inline version.
  const relatedDeals = await prisma.$queryRaw<RelatedDeal[]>`
    WITH latest AS (
      SELECT DISTINCT ON ("discoId")
        "discoId", "precoBrl"::float AS preco
      FROM "HistoricoPreco"
      ORDER BY "discoId", "capturadoEm" DESC
    ),
    avgd AS (
      SELECT "discoId", AVG("precoBrl")::float AS media
      FROM "HistoricoPreco"
      WHERE "capturadoEm" >= NOW() - INTERVAL '30 days'
      GROUP BY "discoId"
    )
    SELECT
      d.id,
      d.titulo,
      d.artista,
      d.slug,
      d."imgUrl",
      d.url,
      d.estilo,
      d.rating,
      d.deal_score                                         AS "dealScore",
      d.confidence_level                                   AS "confidenceLevel",
      l.preco                                              AS "precoAtual",
      COALESCE(a.media, l.preco)                           AS "mediaPreco",
      CASE
        WHEN COALESCE(a.media, 0) > 0
        THEN (COALESCE(a.media, l.preco) - l.preco) / COALESCE(a.media, l.preco)
        ELSE 0
      END                                                  AS desconto,
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
          ORDER  BY "capturadoEm" ASC
          LIMIT  10
        ) sp
      ) AS sparkline
    FROM "Disco" d
    INNER JOIN latest l ON l."discoId" = d.id
    LEFT  JOIN avgd   a ON a."discoId" = d.id
    WHERE d.id != ${disco.id}
      AND d.deal_score IS NOT NULL
    ORDER BY d.deal_score DESC, RANDOM()
    LIMIT 4
  `;

  // Process related deals into DiscoCard-compatible shape
  const processedDeals = relatedDeals.map((deal) => {
    let sparkline: number[] = [];
    if (Array.isArray(deal.sparkline)) {
      sparkline = (deal.sparkline as unknown[]).map(Number).filter((n) => !isNaN(n));
    } else if (typeof deal.sparkline === "string") {
      try {
        sparkline = (JSON.parse(deal.sparkline) as unknown[]).map(Number).filter((n) => !isNaN(n));
      } catch {
        sparkline = [];
      }
    }
    return {
      ...deal,
      rating:          deal.rating ? Number(deal.rating) : null,
      emPromocao:      true, // query already filters deal_score IS NOT NULL
      dealScore:       deal.dealScore !== null && deal.dealScore !== undefined ? Number(deal.dealScore) : null,
      confidenceLevel: deal.confidenceLevel ?? null,
      sparkline,
    };
  });

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-zinc-500 mb-6 flex-wrap">
        <Link href="/" className="hover:text-zinc-300 transition-colors">
          Início
        </Link>
        <span>›</span>
        <Link
          href={`/artista/${slugifyArtist(disco.artista)}`}
          className="hover:text-zinc-300 transition-colors"
        >
          {disco.artista}
        </Link>
        <span>›</span>
        <span className="text-zinc-400 truncate max-w-[200px] sm:max-w-xs">
          {disco.titulo}
        </span>
      </nav>

      {/* Hero — large album art on the left, price details on the right */}
      <div className="flex flex-col sm:flex-row gap-6 mb-8">
        {disco.imgUrl && (
          <div className="relative w-full sm:w-72 sm:h-72 aspect-square sm:aspect-auto shrink-0 bg-zinc-800 rounded-2xl overflow-hidden">
            <Image
              src={disco.imgUrl}
              alt={disco.titulo}
              fill
              sizes="(max-width: 640px) 100vw, 288px"
              className="object-cover"
              unoptimized
              priority
            />
          </div>
        )}

        <div className="flex-1 flex flex-col justify-between">
          <div>
            <Link
              href={`/artista/${slugifyArtist(disco.artista)}`}
              className="text-zinc-500 hover:text-amber-400 text-sm transition-colors"
            >
              {disco.artista}
            </Link>
            <h1 className="text-2xl font-bold text-zinc-100 mt-1 leading-tight">
              {disco.titulo}
            </h1>
            {rating && (
              <p className="text-sm mt-2 flex items-center gap-1">
                <span className="text-amber-400">
                  {"★".repeat(stars)}
                  {"☆".repeat(5 - stars)}
                </span>
                <span className="text-zinc-400 ml-0.5">{rating.toFixed(1)}</span>
              </p>
            )}
          </div>

          <div className="mt-5">
            {/* Price + badges row */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-4xl sm:text-5xl font-bold text-amber-400 leading-none">
                {fmt(precoAtual)}
              </span>
              {Math.abs(desconto) >= 1 && (
                <span
                  className={`text-sm font-bold px-2.5 py-1 rounded-lg ${
                    desconto >= 10
                      ? "bg-emerald-900 text-emerald-400"
                      : desconto > 0
                      ? "bg-zinc-800 text-zinc-400"
                      : "bg-red-900/50 text-red-400"
                  }`}
                >
                  {desconto >= 0 ? "▼" : "▲"} {Math.abs(desconto).toFixed(1)}%
                </span>
              )}
              {statusPreco === "menor" && (
                <span className="text-xs bg-emerald-600 text-white font-bold px-3 py-1 rounded-full">
                  🟢 Menor Preço Histórico
                </span>
              )}
              {statusPreco === "aumento" && (
                <span className="text-xs bg-red-900/70 text-red-400 font-bold px-3 py-1 rounded-full border border-red-800">
                  🔴 Aumento de Preço
                </span>
              )}
              {statusPreco === "estavel" && (
                <span className="text-xs bg-blue-900/70 text-blue-400 font-bold px-3 py-1 rounded-full border border-blue-800">
                  🔵 Preço Estável
                </span>
              )}
            </div>

            {/* Historical average with strikethrough */}
            <p className="text-zinc-500 text-sm">
              vs. média histórica{" "}
              <span className="line-through text-zinc-600">{fmt(media)}</span>
            </p>

            {/* CTA buttons */}
            <div className="flex flex-wrap items-center gap-3 mt-5">
              <a
                href={disco.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm px-6 py-3 rounded-full transition-colors"
              >
                Ver na Amazon
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </a>
            </div>
            <p className="text-zinc-600 text-xs mt-2">
              Atualizado há {updateLabel} · Preços podem variar
            </p>
          </div>
        </div>
      </div>

      {/* Price history */}
      <section className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 mb-6">
        <h2 className="text-base font-semibold text-zinc-100 mb-4">
          Evolução do preço
          <span className="text-zinc-500 text-sm font-normal ml-2">
            ({valores.length}{" "}
            {valores.length === 1 ? "registro" : "registros"})
          </span>
        </h2>

        {/* Stat cards — visually distinct per type */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {/* Atual — neutral */}
          <div className="bg-zinc-800 rounded-lg p-3 border-l-4 border-zinc-600">
            <p className="text-xs text-zinc-500 mb-1">Atual</p>
            <p className="font-bold text-zinc-100 text-sm">{fmt(precoAtual)}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{dataAtualLabel}</p>
          </div>

          {/* Mínimo — green accent */}
          <div className="bg-zinc-800 rounded-lg p-3 border-l-4 border-emerald-600">
            <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
              Mínimo
              <span className="text-emerald-500 text-[10px] font-bold">↓</span>
            </p>
            <p className="font-bold text-emerald-400 text-sm">{fmt(precoMin)}</p>
            {minRecord && (
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {fmtDateTime(minRecord.capturadoEm)}
              </p>
            )}
          </div>

          {/* Máximo — red accent */}
          <div className="bg-zinc-800 rounded-lg p-3 border-l-4 border-red-800">
            <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
              Máximo
              <span className="text-red-500 text-[10px] font-bold">↑</span>
            </p>
            <p className="font-bold text-red-400 text-sm">{fmt(precoMax)}</p>
            {maxRecord && (
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {fmtDateTime(maxRecord.capturadoEm)}
              </p>
            )}
          </div>
        </div>

        <GraficoPreco precos={chartPrecos} />

        {/* Collapsible table with price delta column */}
        {valores.length > 1 && (
          <details className="mt-4">
            <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 select-none transition-colors">
              Ver todos os registros
            </summary>
            <div className="mt-3 max-h-52 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-zinc-600 border-b border-zinc-800">
                    <th className="pb-2 font-medium">Data</th>
                    <th className="pb-2 font-medium text-right">Preço</th>
                    <th className="pb-2 font-medium text-right">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {precosDisplay.map((p, i) => {
                    const prev = precosDisplay[i + 1];
                    const curr = Number(p.precoBrl);
                    const delta = prev ? curr - Number(prev.precoBrl) : null;
                    return (
                      <tr key={i} className="border-b border-zinc-800/50">
                        <td className="py-1.5 text-zinc-500">
                          {fmtDateTime(p.capturadoEm)}
                        </td>
                        <td className="py-1.5 text-right font-medium text-zinc-200">
                          {curr.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </td>
                        <td
                          className={`py-1.5 text-right ${
                            delta === null
                              ? "text-zinc-700"
                              : delta > 0
                              ? "text-red-400"
                              : delta < 0
                              ? "text-emerald-400"
                              : "text-zinc-600"
                          }`}
                        >
                          {delta === null
                            ? "—"
                            : delta === 0
                            ? "="
                            : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </section>

      <p className="text-xs text-zinc-600 text-center">
        Atualizado em {fmtDateTime(disco.updatedAt)} (horário de Brasília) · Dados
        via Amazon.com.br
      </p>

      {/* Related deals — prevents the page from dead-ending */}
      {processedDeals.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">
            Outros discos em oferta
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {processedDeals.map((deal) => (
              <DiscoCard key={deal.id} disco={deal} />
            ))}
          </div>
        </section>
      )}

      <BackToTop />
    </main>
  );
}
