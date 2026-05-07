import { queryPriceUnder200WithCache } from "@/lib/promos";
import DiscoCard from "@/components/DiscoCard";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Discos de Vinil abaixo de R$ 200 — Garimpa Vinil",
  description:
    "Todos os discos de vinil disponíveis por menos de R$ 200 na Amazon Brasil, ordenados pelas melhores ofertas.",
  alternates: { canonical: "/discos-abaixo-de-200" },
  openGraph: {
    title: "Discos de Vinil abaixo de R$ 200 — Garimpa Vinil",
    description:
      "Todos os discos de vinil disponíveis por menos de R$ 200 na Amazon Brasil, ordenados pelas melhores ofertas.",
    url: "/discos-abaixo-de-200",
    type: "website",
  },
};

export default async function DiscosAbaixo200Page() {
  let items: Awaited<ReturnType<typeof queryPriceUnder200WithCache>> = [];
  try {
    items = await queryPriceUnder200WithCache();
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
          Discos abaixo de R$ 200
        </h1>
        <p className="mt-2 text-parchment text-sm max-w-md">
          {items.length > 0
            ? `${items.length} discos disponíveis por menos de R$ 200, ordenados pelas melhores ofertas.`
            : "Nenhum disco disponível no momento."}
        </p>
      </header>

      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {items.map((disco, i) => (
            <DiscoCard key={disco.id} disco={disco} priority={i < 10} />
          ))}
        </div>
      )}
    </main>
  );
}
