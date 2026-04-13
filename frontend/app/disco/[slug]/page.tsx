import { prisma } from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import GraficoPreco from "@/components/GraficoPreco";

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
    title: `${disco.titulo} — Vinil Deals`,
    description: `Histórico de preços de ${disco.titulo} por ${disco.artista} na Amazon Brasil.`,
  };
}

export default async function DiscoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const disco = await prisma.disco.findUnique({
    where: { slug },
    include: {
      precos: {
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
  const emPromocao = valores.length >= 3 && desconto >= 10;

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const rating = disco.rating ? Number(disco.rating) : null;
  const stars = rating ? Math.round(rating) : 0;

  // Prepare chart data
  const chartPrecos = disco.precos.map((p) => ({
    data: p.capturadoEm.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
    dataFull: p.capturadoEm.toLocaleDateString("pt-BR"),
    valor: Number(p.precoBrl),
  }));

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 mb-6 transition-colors"
      >
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
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Voltar
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-6 mb-8">
        {disco.imgUrl && (
          <div className="relative w-full sm:w-44 h-44 shrink-0 bg-zinc-800 rounded-xl overflow-hidden">
            <Image
              src={disco.imgUrl}
              alt={disco.titulo}
              fill
              sizes="176px"
              className="object-cover"
              unoptimized
            />
          </div>
        )}

        <div className="flex-1 flex flex-col justify-between">
          <div>
            <Link
              href={`/?artista=${encodeURIComponent(disco.artista)}`}
              className="text-zinc-500 hover:text-amber-400 text-sm transition-colors"
            >
              {disco.artista}
            </Link>
            <h1 className="text-2xl font-bold text-zinc-100 mt-1 leading-tight">
              {disco.titulo}
            </h1>
            {rating && (
              <p className="text-zinc-400 text-sm mt-2">
                {"★".repeat(stars)}
                {"☆".repeat(5 - stars)}{" "}
                <span className="text-zinc-300">{rating.toFixed(1)}</span>
              </p>
            )}
          </div>

          <div className="mt-4">
            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-3xl font-bold text-amber-400">
                {fmt(precoAtual)}
              </span>
              {Math.abs(desconto) >= 1 && (
                <span
                  className={`text-sm font-semibold px-2 py-0.5 rounded-md ${
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
              {emPromocao && (
                <span className="text-xs bg-emerald-500 text-white font-semibold px-2 py-0.5 rounded-full">
                  Menor Preço
                </span>
              )}
            </div>
            <p className="text-zinc-600 text-xs">vs. média {fmt(media)}</p>

            <a
              href={disco.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm px-5 py-2.5 rounded-full transition-colors"
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

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-zinc-800 rounded-lg p-3 text-center">
            <p className="text-xs text-zinc-500 mb-1">Atual</p>
            <p className="font-bold text-zinc-100 text-sm">
              {fmt(precoAtual)}
            </p>
          </div>
          <div className="bg-zinc-800 rounded-lg p-3 text-center">
            <p className="text-xs text-zinc-500 mb-1">Mínimo</p>
            <p className="font-bold text-emerald-400 text-sm">
              {fmt(precoMin)}
            </p>
          </div>
          <div className="bg-zinc-800 rounded-lg p-3 text-center">
            <p className="text-xs text-zinc-500 mb-1">Máximo</p>
            <p className="font-bold text-red-400 text-sm">{fmt(precoMax)}</p>
          </div>
        </div>

        {/* Interactive chart */}
        <GraficoPreco precos={chartPrecos} />

        {/* Collapsible table */}
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
                  </tr>
                </thead>
                <tbody>
                  {[...disco.precos].reverse().map((p, i) => (
                    <tr key={i} className="border-b border-zinc-800/50">
                      <td className="py-1.5 text-zinc-500">
                        {p.capturadoEm.toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-1.5 text-right font-medium text-zinc-200">
                        {Number(p.precoBrl).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </td>
                    </tr>
                  ))}
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
    </main>
  );
}
