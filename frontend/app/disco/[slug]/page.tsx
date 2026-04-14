import { prisma } from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import GraficoPreco from "@/components/GraficoPreco";
import ShareButton from "@/components/ShareButton";
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
  precoAtual: number;
  mediaPreco: number;
  desconto: number;
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

  // Current price equals the all-time min → show the pill
  const ehMenorPrecoHistorico = valores.length >= 2 && precoAtual <= precoMin;

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

  const fmtDate = (d: Date) => d.toLocaleDateString("pt-BR");

  // Label for the "Atual" stat card
  const dataAtual = disco.precos.at(-1)?.capturadoEm;
  const isHoje =
    dataAtual
      ? dataAtual.toDateString() === new Date().toDateString()
      : false;
  const dataAtualLabel = isHoje ? "Hoje" : dataAtual ? fmtDate(dataAtual) : "—";

  const rating = disco.rating ? Number(disco.rating) : null;
  const stars = rating ? Math.round(rating) : 0;

  const chartPrecos = disco.precos.map((p) => ({
    data: p.capturadoEm.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
    dataFull: p.capturadoEm.toLocaleDateString("pt-BR"),
    valor: Number(p.precoBrl),
  }));

  // Price history displayed newest-first, with delta vs. previous capture
  const precosDisplay = [...disco.precos].reverse();

  // Related deals — 4 other records currently below their historical average
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
      WHERE "capturadoEm" >= NOW() - INTERVAL '365 days'
      GROUP BY "discoId"
      HAVING COUNT(*) >= 3
    )
    SELECT
      d.id,
      d.titulo,
      d.artista,
      d.slug,
      d."imgUrl",
      l.preco AS "precoAtual",
      a.media AS "mediaPreco",
      ((a.media - l.preco) / NULLIF(a.media, 0)) * 100 AS desconto
    FROM "Disco" d
    JOIN latest l ON l."discoId" = d.id
    JOIN avgd a ON a."discoId" = d.id
    WHERE d.id != ${disco.id}
      AND ((a.media - l.preco) / NULLIF(a.media, 0)) * 100 >= 10
    ORDER BY RANDOM()
    LIMIT 4
  `;

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
              {ehMenorPrecoHistorico && (
                <span className="text-xs bg-emerald-600 text-white font-bold px-3 py-1 rounded-full">
                  Menor Preço Histórico
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
              <ShareButton titulo={disco.titulo} artista={disco.artista} />
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
                {fmtDate(minRecord.capturadoEm)}
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
                {fmtDate(maxRecord.capturadoEm)}
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
                          {p.capturadoEm.toLocaleDateString("pt-BR")}
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
        Atualizado em {disco.updatedAt.toLocaleDateString("pt-BR")} · Dados
        via Amazon.com.br
      </p>

      {/* Related deals — prevents the page from dead-ending */}
      {relatedDeals.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">
            Outros discos em oferta
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {relatedDeals.map((deal) => (
              <Link
                key={deal.id}
                href={`/disco/${deal.slug}`}
                className="group bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-colors flex flex-col"
              >
                {/* Thumbnail */}
                <div className="relative aspect-square bg-zinc-800 shrink-0">
                  {deal.imgUrl ? (
                    <Image
                      src={deal.imgUrl}
                      alt={deal.titulo}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-4xl select-none">
                      ♫
                    </div>
                  )}
                  {deal.desconto >= 1 && (
                    <div className="absolute top-2 left-2 bg-red-600 text-white text-[11px] font-bold px-1.5 py-0.5 rounded">
                      -{Math.round(deal.desconto)}%
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 flex-1 flex flex-col">
                  <p className="text-zinc-500 text-xs truncate">{deal.artista}</p>
                  <p className="text-zinc-100 text-sm font-semibold leading-snug line-clamp-2 mt-0.5 flex-1">
                    {deal.titulo}
                  </p>
                  <p className="text-amber-400 font-bold mt-2">
                    {deal.precoAtual.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
