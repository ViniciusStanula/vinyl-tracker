import type { Metadata } from "next";
import Link from "next/link";

import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "Guias de Vinil | Garimpa Vinil",
  description:
    "Guias e rankings sobre discos de vinil: limpeza, grading, prensagens 180g, vinil colorido e os melhores discos de rock por subgênero.",
  alternates: { canonical: "/guias" },
  openGraph: {
    title: "Guias de Vinil | Garimpa Vinil",
    description:
      "Guias e rankings sobre discos de vinil: limpeza, grading, prensagens 180g, vinil colorido e os melhores discos de rock por subgênero.",
    url: "/guias",
    type: "website",
    images: ["/og-default.png"],
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
    slug: "melhores-discos/alice-in-chains",
    title: "Os Melhores Discos do Alice in Chains",
    description:
      "Ranking dos álbuns do Alice in Chains em vinil, com nota do MusicBrainz, popularidade no Last.fm e um vídeo de cada disco.",
    date: "2026-07-21",
    tag: "ranking",
  },
  {
    slug: "melhores-discos/nirvana",
    title: "Os Melhores Discos do Nirvana",
    description:
      "Ranking dos três álbuns de estúdio do Nirvana em vinil, mais a coletânea Incesticide, com nota do MusicBrainz, popularidade no Last.fm e um vídeo de cada disco.",
    date: "2026-07-21",
    tag: "ranking",
  },
  {
    slug: "melhores-discos/megadeth",
    title: "Os Melhores Discos do Megadeth",
    description:
      "Ranking dos álbuns de estúdio do Megadeth em vinil, com nota do MusicBrainz, popularidade no Last.fm e um vídeo de cada disco.",
    date: "2026-07-14",
    tag: "ranking",
  },
  {
    slug: "melhores-discos/iron-maiden",
    title: "Os Melhores Discos do Iron Maiden",
    description:
      "Ranking dos álbuns de estúdio do Iron Maiden em vinil, com nota do MusicBrainz, popularidade no Last.fm e um vídeo de cada disco.",
    date: "2026-07-14",
    tag: "ranking",
  },
  {
    slug: "melhores-discos/metallica",
    title: "Os Melhores Discos do Metallica",
    description:
      "Ranking dos álbuns de estúdio do Metallica em vinil, com nota do MusicBrainz, popularidade no Last.fm e um vídeo de cada disco.",
    date: "2026-07-14",
    tag: "ranking",
  },
  {
    slug: "pre-amplificador-phono",
    title: "Pré-Amplificador Phono: Você Precisa de Um?",
    description:
      "Som fino, baixo e sem grave ao ligar o toca-discos? Falta um pré-phono. O que ele faz, como saber se você já tem um, o erro dos dois prés e os modelos que resolvem na Amazon Brasil.",
    date: "2026-07-10",
    tag: "guia",
  },
  {
    slug: "toca-discos-para-iniciantes",
    title: "Toca-Discos para Iniciantes: Como Escolher",
    description:
      "Vitrola de maleta ou toca-discos de verdade? Cápsula cerâmica vs. magnética, contrapeso, anti-skating e pré-phono explicados — e por que a peça mais barata do aparelho decide o destino da sua coleção.",
    date: "2026-07-10",
    tag: "guia",
  },
  {
    slug: "vinil-colorido-e-picture-disc",
    title: "Vinil Colorido e Picture Disc Valem a Pena?",
    description:
      "Colorido soa pior que preto? E picture disc? Mito vs. realidade técnica: carbon black, polietileno, splatter e quando cada formato vale a pena comprar.",
    date: "2026-06-01",
    tag: "guia",
  },
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
      "Mais de 11.000 álbuns de 1.000 artistas organizados em 18 subgêneros: classic rock, grunge, indie rock, shoegaze e muito mais. Rankings baseados em avaliações do Discogs.",
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

export default function GuiasPage() {
  const breadcrumb = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Guias", item: `${SITE_URL}/guias` },
    ],
  });

  const itemList = toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Guias de Vinil",
    url: `${SITE_URL}/guias`,
    numberOfItems: GUIDES.length,
    itemListElement: GUIDES.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: g.title,
      url: `${SITE_URL}/guias/${g.slug}`,
    })),
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumb }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemList }} />

      <nav aria-label="Navegação estrutural" className="mb-6 text-sm text-dust flex gap-2">
        <Link href="/" className="hover:text-gold transition-colors">Início</Link>
        <span aria-hidden="true">›</span>
        <span className="text-parchment">Guias</span>
      </nav>

      <header className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-black text-cream leading-tight mb-3 [text-wrap:balance]">
          Guias de <span className="text-gold">Vinil</span>
        </h1>
        <p className="text-parchment text-sm leading-relaxed max-w-2xl">
          Tudo que a gente aprendeu garimpando, limpando e colecionando disco: como avaliar o
          estado de um vinil antes de comprar, como limpar e guardar no clima do Brasil, quando
          vale pagar por 180g ou edição colorida, e rankings dos melhores discos por subgênero
          montados com dados do Discogs.
        </p>
        <p className="text-parchment text-sm leading-relaxed max-w-2xl mt-3">
          Cada guia parte do que muda pra quem ouve e compra vinil no Brasil: o clima que empena
          disco, o preço que pesa na hora de escolher entre original e reissue, o sebo onde o
          grading nem sempre é honesto. Os guias práticos ensinam a cuidar, limpar e avaliar; os
          rankings apontam o que procurar primeiro.
        </p>
      </header>

      {/* Featured: newest guide */}
      <Link
        href={`/guias/${GUIDES[0].slug}`}
        className="group block mb-6 bg-sleeve border border-groove rounded-2xl p-6 sm:p-8 hover:border-patina transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-record"
      >
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 ${TAG_COLOR[GUIDES[0].tag]}`}>{TAG_LABEL[GUIDES[0].tag]}</span>
          <span className="text-xs text-dust">{new Date(GUIDES[0].date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</span>
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-black text-cream group-hover:text-gold transition-colors leading-tight mb-3 [text-wrap:balance]">{GUIDES[0].title}</h2>
        <p className="text-parchment text-sm leading-relaxed max-w-2xl mb-5">{GUIDES[0].description}</p>
        <span className="inline-flex items-center gap-1.5 text-gold text-sm font-semibold">
          Ler guia
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </Link>

      {/* Compact list: remaining guides */}
      <div className="divide-y divide-groove">
        {GUIDES.slice(1).map((guide) => (
          <Link
            key={guide.slug}
            href={`/guias/${guide.slug}`}
            className="group flex items-center gap-3 sm:gap-4 py-3.5 -mx-2 px-2 rounded-lg hover:bg-groove/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30"
          >
            <span className={`shrink-0 text-[10px] font-bold border rounded-full px-2 py-0.5 ${TAG_COLOR[guide.tag]}`}>{TAG_LABEL[guide.tag]}</span>
            <span className="font-display text-sm font-black text-cream group-hover:text-gold transition-colors flex-1 leading-snug">{guide.title}</span>
            <span className="text-xs text-dust shrink-0 hidden sm:block tabular-nums">{guide.updated ? "Diário" : new Date(guide.date).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</span>
            <svg className="text-groove group-hover:text-gold transition-colors shrink-0" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
