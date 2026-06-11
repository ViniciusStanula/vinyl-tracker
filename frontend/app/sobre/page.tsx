import BackToTop from "@/components/BackToTop";
import Link from "next/link";

import { SITE_URL } from "@/lib/siteUrl";

const personJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Vinicius Stanula",
  url: SITE_URL,
  sameAs: ["https://linkedin.com/in/vinicius-stanula"],
}).replace(/<\//g, "<\\/");

const breadcrumbJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Sobre", item: `${SITE_URL}/sobre` },
  ],
}).replace(/<\//g, "<\\/");

const faqJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "O que é o Garimpa Vinil?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Um catálogo de discos de vinil disponíveis na Amazon Brasil, com preços atualizados regularmente para ajudar você a encontrar bons momentos para comprar.",
      },
    },
    {
      "@type": "Question",
      name: "Como o Garimpa Vinil obtém os preços?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Agregamos informações de preços de fontes públicas. Os preços são atualizados regularmente para refletir os valores praticados atualmente na Amazon Brasil.",
      },
    },
  ],
}).replace(/<\//g, "<\\/");


export const metadata = {
  title: "Sobre — Garimpa Vinil",
  description:
    "Conheça o Garimpa Vinil: catálogo de discos de vinil na Amazon Brasil com preços atualizados. Encontre o melhor momento para comprar.",
  alternates: { canonical: "/sobre" },
  openGraph: {
    title: "Sobre — Garimpa Vinil",
    description:
      "Conheça o Garimpa Vinil: catálogo de discos de vinil na Amazon Brasil com preços atualizados. Encontre o melhor momento para comprar.",
    url: "/sobre",
    type: "website",
    images: ["/og-default.png"],
  },
  twitter: {
    card: "summary",
    title: "Sobre — Garimpa Vinil",
    description:
      "Conheça o Garimpa Vinil: catálogo de discos de vinil na Amazon Brasil com preços atualizados. Encontre o melhor momento para comprar.",
  },
};

export default function SobrePage() {
  return (
    <main id="main-content" className="max-w-3xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: personJsonLd }} />

      {/* ── Breadcrumbs ─────────────────────────────────────────── */}
      <nav className="mb-6 text-sm text-dust flex gap-2">
        <Link href="/" className="hover:text-gold transition-colors">Início</Link>
        <span>›</span>
        <span className="text-parchment">Sobre</span>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <header className="relative mb-8 overflow-hidden rounded-2xl bg-sleeve border border-groove px-6 py-7 vinyl-grooves">
        <h1 className="font-display text-3xl sm:text-4xl font-black text-cream leading-tight">
          O que é o{" "}
          <span className="text-gold">Garimpa Vinil</span>
        </h1>
        <p className="mt-3 text-parchment text-sm max-w-lg leading-relaxed">
          Um catálogo de discos de vinil disponíveis na Amazon Brasil, com preços
          atualizados regularmente para ajudar você a encontrar bons momentos para comprar.
        </p>
      </header>

      {/* ── O que o site faz ────────────────────────────────────── */}
      <section className="mb-6 bg-sleeve border border-groove rounded-xl p-6">
        <h2 className="font-display text-xl font-bold text-cream mb-3">
          O que acontece nos bastidores
        </h2>
        <p className="text-parchment text-sm leading-relaxed mb-3">
          Agregamos informações de preços de fontes públicas para ajudar você a
          encontrar bons momentos para comprar. Os preços são atualizados regularmente
          para que o catálogo reflita os valores praticados atualmente.
        </p>
        <p className="text-parchment text-sm leading-relaxed">
          Cada página de disco exibe o preço atual e um link direto para a Amazon.
          Clicando em "Ver na Amazon" você vai para a página oficial do produto, onde
          o preço em tempo real é sempre o mais preciso.
        </p>
      </section>

      <BackToTop />
    </main>
  );
}
