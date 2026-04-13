import { prisma } from "@/lib/prisma";
import DiscoCard from "@/components/DiscoCard";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 21600; // ISR: revalidate every 6 hours

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artista = decodeURIComponent(slug);
  return {
    title: `${artista} — Vinyl Tracker`,
    description: `Todos os discos de vinil de ${artista} na Amazon Brasil com histórico de preços.`,
  };
}

export default async function ArtistaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artista = decodeURIComponent(slug);

  const discos = await prisma.disco.findMany({
    where: { artista },
    include: {
      precos: {
        orderBy: { capturadoEm: "desc" },
        take: 60,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (discos.length === 0) notFound();

  const discosProcessados = discos.map((disco) => {
    const precos = disco.precos.map((p) => Number(p.precoBrl));
    const precoAtual = precos[0] ?? 0;
    const media =
      precos.length > 0
        ? precos.reduce((a, b) => a + b, 0) / precos.length
        : 0;
    return {
      ...disco,
      rating: disco.rating ? Number(disco.rating) : null,
      precoAtual,
      emPromocao: precos.length >= 3 && precoAtual < media * 0.9,
    };
  });

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 mb-6 transition-colors"
      >
        ← Voltar
      </Link>

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-100">{artista}</h1>
        <p className="mt-1 text-zinc-500 text-sm">
          {discosProcessados.length}{" "}
          {discosProcessados.length === 1 ? "disco" : "discos"} rastreados
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {discosProcessados.map((disco) => (
          <DiscoCard key={disco.id} disco={disco} />
        ))}
      </div>
    </main>
  );
}
