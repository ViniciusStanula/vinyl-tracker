import { queryOfertasWithCache, OFERTAS_PAGE_SIZE, ofertasHref } from "@/lib/db/ofertas";
import DiscoCard from "@/components/DiscoCard";
import Pagination from "@/components/Pagination";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toJsonLd, discoListItems } from "@/lib/jsonld";
import { SITE_URL } from "@/lib/siteUrl";
import { DEAL_TIERS } from "@/lib/dealTiers";

// Tier metadata lives in lib/dealTiers.ts so this page, the listing-page
// legend and llms.txt cannot describe the same badge differently again.
const TIERS = DEAL_TIERS;

/**
 * One page of the deals listing. Shared by /ofertas and /ofertas/pagina/[n] so
 * the two cannot drift apart.
 *
 * The whole set used to render on a single URL: 557 cards and 3.4 MB of HTML.
 * Nothing was removed here — the same offers in the same order, split across
 * pages. queryOfertas already sorts by tier then discount, so each page holds
 * contiguous tier runs and the section headings stay meaningful.
 */
export default async function OfertasView({ page }: { page: number }) {
  let allItems: Awaited<ReturnType<typeof queryOfertasWithCache>> = [];
  try {
    allItems = await queryOfertasWithCache();
  } catch {
    // DB unavailable — render empty state
  }

  const total = allItems.length;
  const totalPages = Math.max(1, Math.ceil(total / OFERTAS_PAGE_SIZE));
  // Deals expire, so the page count shrinks. A prerendered high page that no
  // longer has offers should 404 rather than render an empty grid.
  if (page > 1 && page > totalPages) notFound();

  const start = (page - 1) * OFERTAS_PAGE_SIZE;
  const items = allItems.slice(start, start + OFERTAS_PAGE_SIZE);

  const byTier = new Map<number, typeof items>();
  for (const item of items) {
    const t = item.dealScore ?? 0;
    if (!byTier.has(t)) byTier.set(t, []);
    byTier.get(t)!.push(item);
  }

  // Visible tiers with a running offset, so only the first ~10 cards on this
  // page get image priority (LCP). Offset is derived from the preceding tiers'
  // sizes (no mutation) to satisfy the render-immutability lint rule.
  const visibleTiers = TIERS
    .map((tier) => ({ ...tier, items: byTier.get(tier.score) ?? [] }))
    .filter((tier) => tier.items.length > 0);
  const sections = visibleTiers.map((tier, idx) => ({
    ...tier,
    offset: visibleTiers
      .slice(0, idx)
      .reduce((sum, prev) => sum + prev.items.length, 0),
  }));

  const canonicalPath = ofertasHref(page);

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Ofertas", item: `${SITE_URL}/ofertas` },
    ],
  });

  // Positions continue across pages so the list reads as one sequence rather
  // than restarting at 1 on every page.
  const itemListJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Ofertas de Discos de Vinil",
    url: `${SITE_URL}${canonicalPath}`,
    numberOfItems: total,
    itemListElement: discoListItems(items, SITE_URL, { startPosition: start + 1 }),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJsonLd }} />

      <header className="mb-6">
        <Link
          href="/"
          className="text-parchment hover:text-gold text-sm transition-colors mb-4 inline-block"
        >
          ← Início
        </Link>
        <h1 className="font-display text-3xl sm:text-4xl font-black text-cream leading-tight">
          Ofertas de hoje
        </h1>
        <p className="mt-2 text-parchment text-sm max-w-xl">
          {total > 0
            ? `${total.toLocaleString("pt-BR")} discos de vinil com preço abaixo da média histórica, do melhor preço para a boa oferta.`
            : "Nenhuma oferta disponível no momento. Volte mais tarde."}
        </p>
      </header>

      {/* ── Legenda das ofertas ── */}
      {total > 0 && (
        <ul className="flex flex-wrap gap-x-5 gap-y-2 mb-8 text-xs text-dust">
          {TIERS.map((t) => (
            <li key={t.score} className="flex items-center gap-1.5">
              <span className="text-gold font-semibold">
                {t.mark ? `${t.mark} ` : ""}{t.label}
              </span>
              <span className="opacity-70">{t.blurb}</span>
            </li>
          ))}
        </ul>
      )}

      {sections.map((section) => (
        <section key={section.score} className="mb-12" aria-label={section.label}>
          <div className="flex items-baseline gap-3 mb-4">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-cream">
              {section.mark ? `${section.mark} ` : ""}{section.label}
            </h2>
            <span className="text-dust text-sm tabular-nums">
              {section.items.length.toLocaleString("pt-BR")}
            </span>
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {section.items.map((disco, i) => (
              <li key={disco.id}>
                <DiscoCard disco={disco} priority={section.offset + i < 10} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          searchParams={{}}
          hrefFor={ofertasHref}
        />
      )}
    </div>
  );
}
