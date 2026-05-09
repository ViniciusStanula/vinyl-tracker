import { queryTopArtistAllDealsWithCache } from "@/lib/carousel";
import DiscoCard from "@/components/DiscoCard";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Artistas mais Ouvidos — Garimpa Vinil",
  description:
    "Os artistas mais ouvidos do mundo com as melhores ofertas em discos de vinil na Amazon Brasil.",
  alternates: { canonical: "/artistas-mais-ouvidos" },
  openGraph: {
    title: "Artistas mais Ouvidos — Garimpa Vinil",
    description:
      "Os artistas mais ouvidos do mundo com as melhores ofertas em discos de vinil na Amazon Brasil.",
    url: "/artistas-mais-ouvidos",
    type: "website",
  },
};

const PER_PAGE = 24;

export default async function ArtistasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  let items: Awaited<ReturnType<typeof queryTopArtistAllDealsWithCache>>["items"] = [];
  let total = 0;
  try {
    ({ items, total } = await queryTopArtistAllDealsWithCache(page));
  } catch {
    // DB unavailable
  }

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <header className="mb-8">
        <Link
          href="/"
          className="text-parchment hover:text-gold text-sm transition-colors mb-4 inline-block"
        >
          ← Início
        </Link>
        <h1 className="font-display text-3xl sm:text-4xl font-black text-cream leading-tight">
          Artistas mais Ouvidos
        </h1>
        <p className="mt-2 text-parchment text-sm max-w-md">
          Todos os discos dos artistas do top mundial, ordenados por oferta.
          {total > 0 && (
            <span className="ml-1 text-dust">({total} discos)</span>
          )}
        </p>
      </header>

      {items.length === 0 ? (
        <p className="text-dust text-sm">Nenhum resultado disponível no momento.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items.map((disco, i) => (
              <DiscoCard key={disco.id} disco={disco} priority={i < 10} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Paginação">
              {page > 1 && (
                <Link
                  href={`/artistas-mais-ouvidos?page=${page - 1}`}
                  className="px-4 py-2 rounded-lg bg-groove text-parchment text-sm hover:text-gold transition-colors"
                >
                  ← Anterior
                </Link>
              )}
              <span className="px-4 py-2 text-sm text-dust">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/artistas-mais-ouvidos?page=${page + 1}`}
                  className="px-4 py-2 rounded-lg bg-groove text-parchment text-sm hover:text-gold transition-colors"
                >
                  Próxima →
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
