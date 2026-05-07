import { queryCarouselDiscosWithCache } from "@/lib/carousel";
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

export default async function ArtistasPage() {
  let items: Awaited<ReturnType<typeof queryCarouselDiscosWithCache>> = [];
  try {
    items = await queryCarouselDiscosWithCache();
  } catch {
    // DB unavailable
  }

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
          Artistas do top mundial com a melhor oferta disponível em vinil, ordenados por desconto.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="text-dust text-sm">Nenhum resultado disponível no momento.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {items.map((disco, i) => (
            <DiscoCard key={disco.id} disco={disco} priority={i < 10} />
          ))}
        </div>
      )}
    </main>
  );
}
