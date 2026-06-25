import { queryOfertasWithCache } from "@/lib/db/ofertas";
import DiscoCard from "@/components/DiscoCard";
import Link from "next/link";
import type { Metadata } from "next";
import { toJsonLd } from "@/lib/jsonld";
import { SITE_URL } from "@/lib/siteUrl";

export const revalidate = 14400;

// Tier metadata (3 = best). Copy is pt-BR and avoids em dashes per house style.
const TIERS = [
  {
    score: 3,
    label: "Melhor Preço",
    mark: "✦",
    blurb: "No menor preço já registrado, ou bem perto dele.",
  },
  {
    score: 2,
    label: "Ótima Oferta",
    mark: "✓",
    blurb: "Abaixo da média dos últimos 90 dias.",
  },
  {
    score: 1,
    label: "Boa Oferta",
    mark: "",
    blurb: "Com desconto sobre a média histórica de preço.",
  },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  let count = 0;
  try {
    count = (await queryOfertasWithCache()).length;
  } catch {
    // DB unavailable — fall back to generic description
  }
  const title = "Ofertas de Discos de Vinil — Garimpa Vinil";
  const description = count > 0
    ? `${count.toLocaleString("pt-BR")} discos de vinil em oferta na Amazon Brasil agora, separados por Melhor Preço, Ótima Oferta e Boa Oferta sobre a média histórica.`
    : "Discos de vinil em oferta na Amazon Brasil, separados por Melhor Preço, Ótima Oferta e Boa Oferta sobre a média histórica de preço.";
  return {
    title,
    description,
    // No cross-language alternates: the US peer has no /ofertas equivalent, and
    // hreflang must be reciprocal — a dangling en-US target would be an SEO error.
    alternates: {
      canonical: "/ofertas",
    },
    openGraph: {
      title,
      description,
      url: "/ofertas",
      type: "website",
      images: ["/og-default.png"],
    },
  };
}

export default async function OfertasPage() {
  let items: Awaited<ReturnType<typeof queryOfertasWithCache>> = [];
  try {
    items = await queryOfertasWithCache();
  } catch {
    // DB unavailable — render empty state
  }

  const byTier = new Map<number, typeof items>();
  for (const item of items) {
    const t = item.dealScore ?? 0;
    if (!byTier.has(t)) byTier.set(t, []);
    byTier.get(t)!.push(item);
  }

  const total = items.length;

  // Visible tiers with a running offset, so only the first ~10 cards overall get
  // image priority (LCP). Offset is derived from the preceding tiers' sizes
  // (no mutation) to satisfy the render-immutability lint rule.
  const visibleTiers = TIERS
    .map((tier) => ({ ...tier, items: byTier.get(tier.score) ?? [] }))
    .filter((tier) => tier.items.length > 0);
  const sections = visibleTiers.map((tier, idx) => ({
    ...tier,
    offset: visibleTiers
      .slice(0, idx)
      .reduce((sum, prev) => sum + prev.items.length, 0),
  }));

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Ofertas", item: `${SITE_URL}/ofertas` },
    ],
  });

  const itemListJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Ofertas de Discos de Vinil",
    url: `${SITE_URL}/ofertas`,
    numberOfItems: total,
    itemListElement: items.slice(0, 10).map((disco, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/disco/${disco.slug}`,
      name: disco.titulo,
    })),
  });

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {section.items.map((disco, i) => (
              <DiscoCard key={disco.id} disco={disco} priority={section.offset + i < 10} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
