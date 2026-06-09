import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync } from "fs";
import { join } from "path";
import ChartsContent from "./ChartsContent";
import type { ChartsData } from "./ChartsContent";

import { SITE_URL } from "@/lib/siteUrl";

const PAGE_TITLE = "Top Artistas do Spotify por País, Atualizado Diariamente";
const PAGE_DESC =
  "Ranking diário dos 10 artistas mais ouvidos no Spotify em 20 países, com dados dos charts públicos via kworb.net. Atualizado todo dia às 8h UTC.";

export const metadata: Metadata = {
  title: "Top Artistas do Spotify por País (Diário) | Garimpa Vinil",
  description: PAGE_DESC,
  alternates: { canonical: "/guias/top-artistas-spotify" },
  openGraph: {
    type: "article",
    title: PAGE_TITLE,
    description: PAGE_DESC,
    url: "/guias/top-artistas-spotify",
    images: ["/og-default.png"],
  },
  twitter: {
    card: "summary",
    title: PAGE_TITLE,
    description: PAGE_DESC,
  },
};

function loadData(): ChartsData | null {
  try {
    const raw = readFileSync(
      join(process.cwd(), "data", "top_artists.json"),
      "utf-8"
    );
    return JSON.parse(raw) as ChartsData;
  } catch {
    return null;
  }
}

function buildJsonLd(data: ChartsData | null) {
  const dateStr = data?.last_updated?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: PAGE_TITLE,
    description: PAGE_DESC,
    datePublished: dateStr,
    dateModified: dateStr,
    inLanguage: "pt-BR",
    author: { "@type": "Organization", name: "Garimpa Vinil" },
    publisher: { "@type": "Organization", name: "Garimpa Vinil" },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/guias/top-artistas-spotify`,
    },
  };
}

export default function TopArtistasSptPage() {
  const data = loadData();
  const jsonLd = JSON.stringify(buildJsonLd(data)).replace(/<\//g, "<\\/");
  const breadcrumb = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Guias", item: `${SITE_URL}/guias` },
      {
        "@type": "ListItem",
        position: 3,
        name: "Top Artistas Spotify",
        item: `${SITE_URL}/guias/top-artistas-spotify`,
      },
    ],
  }).replace(/<\//g, "<\\/");

  return (
    <main id="main-content" className="max-w-5xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumb }} />

      {/* ── Breadcrumb ──────────────────────────────────────────── */}
      <nav className="mb-6 text-sm text-dust flex gap-2 flex-wrap">
        <Link href="/" className="hover:text-gold transition-colors">
          Início
        </Link>
        <span>›</span>
        <Link href="/guias" className="hover:text-gold transition-colors">
          Guias
        </Link>
        <span>›</span>
        <span className="text-parchment">Top Artistas Spotify</span>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <header className="relative mb-8 overflow-hidden rounded-2xl bg-sleeve border border-groove px-6 py-7 vinyl-grooves">
        <h1 className="font-display text-3xl sm:text-4xl font-black text-cream leading-tight">
          Top Artistas do{" "}
          <span className="text-gold">Spotify</span>{" "}
          por País
        </h1>
        <p className="mt-3 text-parchment text-sm max-w-2xl leading-relaxed">
          Ranking diário dos 10 artistas mais ouvidos no Spotify em 20 países, calculado com base
          nos streams diários agregados. Dados do{" "}
          <a
            href="https://kworb.net/spotify/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:text-goldlit underline underline-offset-2 transition-colors"
          >
            kworb.net
          </a>
          , atualizado todos os dias às 8h&nbsp;UTC.
        </p>
        {data?.last_updated && (
          <p className="mt-4 text-xs text-parchment opacity-80">
            Última atualização:{" "}
            <span className="text-gold font-medium opacity-100">
              {new Date(data.last_updated).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Sao_Paulo",
              })}
            </span>{" "}
            (horário de Brasília)
          </p>
        )}
      </header>

      {/* ── Guia de uso ─────────────────────────────────────────── */}
      <section className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-sleeve border border-groove rounded-xl p-5">
          <h2 className="font-display text-base font-bold text-cream mb-2">
            O que são os &ldquo;streams por dia&rdquo;?
          </h2>
          <p className="text-parchment text-sm leading-relaxed">
            É a soma dos streams diários de <em>todas</em> as músicas daquele artista que entraram no
            chart daquele país naquela data. Um artista com 3 músicas no top&nbsp;200 acumula os
            streams das três, por isso pode superar artistas com apenas uma faixa popular.
          </p>
        </div>

        <div className="bg-sleeve border border-groove rounded-xl p-5">
          <h2 className="font-display text-base font-bold text-cream mb-2">
            &ldquo;Ouvintes mensais&rdquo; é diferente?
          </h2>
          <p className="text-parchment text-sm leading-relaxed">
            Sim. Ouvintes mensais é o número global de pessoas distintas que ouviram o artista nos
            últimos 28 dias, independente de país. Um artista pode ter muitos ouvintes mensais mas
            poucos streams diários num país específico, e vice-versa.
          </p>
        </div>

        <div className="bg-sleeve border border-groove rounded-xl p-5">
          <h2 className="font-display text-base font-bold text-cream mb-2">
            Como usar para garimpar vinil?
          </h2>
          <p className="text-parchment text-sm leading-relaxed">
            Artistas em alta costumam ter discos com demanda crescente, e preços que sobem rápido.
            Viu um nome novo no ranking? Pesquise no{" "}
            <Link href="/" className="text-gold hover:text-goldlit underline underline-offset-2 transition-colors">
              Garimpa Vinil
            </Link>{" "}
            se há vinil disponível na Amazon Brasil antes que o preço suba. Veja também os{" "}
            <Link href="/artistas-mais-ouvidos" className="text-gold hover:text-goldlit underline underline-offset-2 transition-colors">
              artistas mais ouvidos com vinil à venda
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ── Charts interativos ───────────────────────────────────── */}
      <ChartsContent data={data} />

      {/* ── Seções explicativas — abaixo do ranking ──────────────── */}
      <div className="mt-10 grid sm:grid-cols-2 gap-4">
        <section className="bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-base font-bold text-cream mb-3">
            Sobre os dados
          </h2>
          <div className="space-y-3 text-parchment text-sm leading-relaxed">
            <p>
              Dados do{" "}
              <a
                href="https://kworb.net/spotify/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover:text-goldlit underline underline-offset-2 transition-colors"
              >
                kworb.net
              </a>
              {" "}(site independente que agrega os charts públicos do Spotify). Fotos e
              nomes via API pública do Spotify (oEmbed). Atualização diária, com defasagem
              de algumas horas após os charts oficiais.
            </p>
          </div>
        </section>

        <section className="bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-base font-bold text-cream mb-3">
            Por que alguns artistas aparecem em vários países?
          </h2>
          <p className="text-parchment text-sm leading-relaxed">
            Artistas com apelo global (pop internacional, K-pop) dominam múltiplos
            países ao mesmo tempo. Artistas regionais (funk, corrido, J-pop) tendem
            a aparecer só no chart do seu país. A tabela{" "}
            <span className="text-gold font-medium">&ldquo;Artistas mais globais&rdquo;</span>{" "}
            acima mostra essa presença simultânea.
          </p>
        </section>
      </div>
    </main>
  );
}
