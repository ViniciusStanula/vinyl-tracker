import { notFound } from "next/navigation";
import OfertasView from "@/components/OfertasView";
import { getOfertasPageCount } from "@/lib/db/ofertas";
import type { Metadata } from "next";

export const revalidate = 14400;

/**
 * Pages 2..N of the deals listing. Page 1 stays at /ofertas.
 *
 * Paginating on the path rather than with `?page=` is deliberate: reading a
 * searchParam here would make the route dynamic, so every request would render
 * from scratch instead of being served from the CDN — the exact problem that
 * makes /disco uncacheable today.
 */
export async function generateStaticParams() {
  const totalPages = await getOfertasPageCount();
  return Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => ({
    n: String(i + 2),
  }));
}

function parsePage(raw: string): number | null {
  // Only bare integers — "02", "2e1" and "-2" would each be a duplicate URL
  // for a page that already exists at its canonical spelling.
  if (!/^[1-9][0-9]*$/.test(raw)) return null;
  return Number(raw);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ n: string }>;
}): Promise<Metadata> {
  const { n } = await params;
  const page = parsePage(n);
  if (page === null) return { title: "Ofertas de Discos de Vinil | Garimpa Vinil" };

  const title = `Ofertas de Discos de Vinil — Página ${page} | Garimpa Vinil`;
  return {
    title,
    description:
      "Discos de vinil em oferta na Amazon Brasil, separados por Melhor Preço, Ótima Oferta e Boa Oferta sobre a média histórica de preço.",
    // Deeper pages are follow-but-noindex, matching how /disco treats page > 1:
    // the offers on them are already linked from their own record pages, and
    // the set churns as deals expire, so indexing them adds nothing.
    robots: { index: false, follow: true },
    alternates: { canonical: `/ofertas/pagina/${page}` },
  };
}

export default async function OfertasPaginaPage({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const { n } = await params;
  const page = parsePage(n);
  // Page 1 has a canonical home at /ofertas — don't serve it twice.
  if (page === null || page < 2) notFound();
  return <OfertasView page={page} />;
}
