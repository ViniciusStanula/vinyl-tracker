import { prisma } from "@/lib/prisma";
import DiscoCard from "@/components/DiscoCard";
import Link from "next/link";
import { notFound } from "next/navigation";
import { slugifyArtist } from "@/lib/slugify";

export const revalidate = 21600; // ISR: revalidate every 6 hours

/**
 * Returns all distinct artist name variants that map to the given slug,
 * plus a canonical display name (the one that looks cleanest — no commas,
 * prefer mixed-case over ALL CAPS).
 */
async function resolveArtista(
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
}

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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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
    orderBy: { updatedAt: "desc" },
  });

  if (discos.length === 0) notFound();

  const discosProcessados = discos.map((disco) => {
    const precos = disco.precos.map((p) => Number(p.precoBrl));
    const precoAtual = precos[0] ?? 0;
    const media =
      precos.length > 0
        ? precos.reduce((a, b) => a + b, 0) / precos.length
        : precoAtual;
    const desconto = media > 0 ? (media - precoAtual) / media : 0;
    return {
      ...disco,
      rating: disco.rating ? Number(disco.rating) : null,
      precoAtual,
      mediaPreco: media,
      emPromocao: precos.length >= 3 && desconto >= 0.1,
      desconto,
    };
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
