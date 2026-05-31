import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://garimpavinil.com.br";

export const metadata: Metadata = {
  title: "Guias de Vinil — Garimpa Vinil",
  description:
    "Guias, rankings e artigos sobre discos de vinil: como cuidar do seu vinil, top artistas do Spotify por país, e muito mais.",
  alternates: { canonical: "/guias" },
  openGraph: {
    title: "Guias de Vinil — Garimpa Vinil",
    description:
      "Guias, rankings e artigos sobre discos de vinil: como cuidar do seu vinil, top artistas do Spotify por país, e muito mais.",
    url: "/guias",
    type: "website",
  },
};

interface Guide {
  slug: string;
  title: string;
  description: string;
  date: string;
  tag: "ranking" | "guia" | "dicas";
  updated?: boolean;
}

const TAG_LABEL: Record<Guide["tag"], string> = {
  ranking: "Ranking",
  guia: "Guia",
  dicas: "Dicas",
};

const TAG_COLOR: Record<Guide["tag"], string> = {
  ranking: "text-gold border-gold/30 bg-gold/10",
  guia: "text-deallit border-deal/30 bg-deal/10",
  dicas: "text-parchment border-groove bg-sleeve",
};

// Add new guides here — most recent first
const GUIDES: Guide[] = [
  {
    slug: "como-avaliar-estado-disco-vinil",
    title: "Como Avaliar o Estado de um Disco de Vinil",
    description:
      "Do Mint ao Poor: o que cada grau significa na prática, como inspecionar disco e capa separadamente, abreviações do Discogs e como o estado afeta o preço.",
    date: "2026-05-31",
    tag: "guia",
  },
  {
    slug: "vinil-180g-vale-a-pena",
    title: "Vinil 180g Vale a Pena? Diferença Real ou Marketing?",
    description:
      "O peso do disco influencia o som? Separamos o que é diferença real (durabilidade, VTA, superfície) de marketing puro, com foco no bolso do comprador brasileiro.",
    date: "2026-05-31",
    tag: "guia",
  },
  {
    slug: "como-cuidar-de-discos-de-vinil",
    title: "Como Cuidar de Discos de Vinil",
    description:
      "Guia completo: limpeza, armazenamento no clima do Brasil, cuidados com a agulha, os 5 erros que destroem coleções e checklist de manutenção para sua coleção durar décadas.",
    date: "2026-05-27",
    tag: "guia",
  },
  {
    slug: "rock",
    title: "Melhores Discos de Rock por Subgênero",
    description:
      "Mais de 11.000 álbuns de 1.000 artistas organizados em 18 subgêneros — classic rock, grunge, indie rock, shoegaze e muito mais. Rankings baseados em avaliações do Discogs.",
    date: "2026-05-25",
    tag: "ranking",
  },
  {
    slug: "top-artistas-spotify",
    title: "Top Artistas do Spotify por País",
    description:
      "Ranking diário dos 10 artistas mais ouvidos no Spotify em 20 países. Atualizado automaticamente todo dia às 8h UTC.",
    date: "2026-05-20",
    tag: "ranking",
    updated: true,
  },
];

function GuideCard({ guide }: { guide: Guide }) {
  return (
    <Link
      href={`/guias/${guide.slug}`}
      className="group block bg-sleeve border border-groove rounded-xl p-5 hover:border-patina active:border-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-record"
    >
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 ${TAG_COLOR[guide.tag]}`}
        >
          {TAG_LABEL[guide.tag]}
        </span>
        {guide.updated && (
          <span className="text-xs text-dust">Atualizado diariamente</span>
        )}
        {!guide.updated && (
          <span className="text-xs text-dust">
            {new Date(guide.date).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        )}
      </div>
      <h2 className="font-display text-lg font-bold text-cream group-hover:text-gold transition-colors leading-snug mb-2">
        {guide.title}
      </h2>
      <p className="text-parchment text-sm leading-relaxed">{guide.description}</p>
      <span className="inline-flex items-center gap-1 mt-4 text-gold text-xs font-medium">
        Ler guia
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
}

export default function GuiasPage() {
  const breadcrumb = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Guias", item: `${SITE_URL}/guias` },
    ],
  });

  return (
    <main id="main-content" className="max-w-4xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumb }} />

      <nav className="mb-6 text-sm text-dust flex gap-2">
        <Link href="/" className="hover:text-gold transition-colors">
          Início
        </Link>
        <span>›</span>
        <span className="text-parchment">Guias</span>
      </nav>

      <header className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-black text-cream leading-tight mb-3">
          Guias de <span className="text-gold">Vinil</span>
        </h1>
        <p className="text-parchment text-sm max-w-xl leading-relaxed">
          Rankings, dicas e guias sobre discos de vinil — do cuidado com a coleção
          ao que está tocando no mundo todo agora.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-4">
        {GUIDES.map((guide) => (
          <GuideCard key={guide.slug} guide={guide} />
        ))}
      </div>
    </main>
  );
}
