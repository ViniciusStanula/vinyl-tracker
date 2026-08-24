import Link from "next/link";
import { HubHeader, HubTile } from "@/components/hub/HubUI";
import { getEdicoesList } from "@/lib/db/edicaoVinil";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";
import type { Metadata } from "next";

export const revalidate = 14400;

export const metadata: Metadata = {
  title: "Edições Especiais de Vinil | Garimpa Vinil",
  description:
    "Vinil por tipo de edição: picture disc, box set, Record Store Day, numerado e mais, cada um com histórico de preços de 12 meses na Amazon Brasil.",
  alternates: { canonical: "/edicao" },
  openGraph: {
    title: "Edições Especiais de Vinil | Garimpa Vinil",
    description: "Explore discos de vinil por tipo de edição especial.",
    url: "/edicao",
    type: "website",
    images: ["/og-default.png"],
  },
};

/** Entries listed in this hub's ItemList JSON-LD. */
const HUB_LIST_CAP = 100;

export default async function EdicaoIndexPage() {
  let edicoes: Awaited<ReturnType<typeof getEdicoesList>> = [];
  try {
    edicoes = await getEdicoesList();
  } catch {
    // DB unavailable
  }

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Edições", item: `${SITE_URL}/edicao` },
    ],
  });

  // The hub's own links, as a list. These pages carried a breadcrumb and
  // nothing else, so the markup said a page existed here and never that it
  // indexes the whole facet — the counts and destinations were visible to a
  // reader and invisible to a parser.
  const itemListJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Tipos de edição especial em vinil",
    url: `${SITE_URL}/edicao`,
    numberOfItems: edicoes.length,
    // numberOfItems stays the true total; the entries themselves are capped.
    // Listing all 688 styles cost 77KB of markup on one page — a parser needs
    // the shape of the list and the count, not every row, and the visible page
    // and the sitemap both still carry the full set.
    itemListElement: edicoes.slice(0, HUB_LIST_CAP).map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: e.label,
      url: `${SITE_URL}/edicao/${e.slug}`,
    })),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJsonLd }} />

      <nav aria-label="Navegação estrutural" className="flex items-center gap-1.5 text-sm text-dust mb-6">
        <Link href="/" className="hover:text-cream transition-colors">Início</Link>
        <span aria-hidden="true">›</span>
        <span className="text-parchment">Edições</span>
      </nav>

      <HubHeader
        eyebrow="Por edição"
        title="Edições Especiais"
        description={
          edicoes.length > 0
            ? `${edicoes.length} tipos de edição especial de vinil monitorados na Amazon Brasil, com histórico de preços de 12 meses.`
            : "Discos de vinil agrupados pelo tipo de edição especial na Amazon Brasil."
        }
      />

      {edicoes.length === 0 ? (
        <p className="text-dust text-sm">Nenhuma edição disponível no momento.</p>
      ) : (
        // At most eight edition types, so the mosaic is the whole page — the
        // same call /decadas makes at its size. Ordered by catalogue depth.
        <ul className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {edicoes.map((e, i) => (
            <li key={e.slug}>
              <HubTile
                href={`/edicao/${e.slug}`}
                label={e.label}
                count={e.discoCount}
                badge={i === 0 ? "Mais discos" : undefined}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Prose below the grid: eight tiles left this hub at 70 words, thin
          enough that the 24 Aug crawl flagged it. */}
      <section aria-labelledby="sobre-edicoes" className="mt-14 max-w-2xl">
        <h2 id="sobre-edicoes" className="font-display text-xl font-black text-cream mb-4">
          O que cada tipo de edição significa
        </h2>
        <div className="flex flex-col gap-4 text-parchment text-sm leading-relaxed">
          <p>
            <strong className="text-cream">Edição limitada</strong> é a mais comum e a
            mais vaga: indica uma tiragem fechada, mas a gravadora nem sempre diz de
            quantas cópias. Quando o número aparece impresso na capa ou na bolacha, o
            disco costuma vir também como{" "}
            <strong className="text-cream">numerado</strong>, e aí a tiragem é
            verificável.
          </p>
          <p>
            <strong className="text-cream">Picture disc</strong> traz a arte impressa
            no próprio vinil, sobre uma base de material diferente do preto comum —
            bonito de olhar, historicamente pior de ouvir.{" "}
            <strong className="text-cream">Zoetrope</strong> é o mesmo princípio levado
            ao movimento: a arte anima enquanto o disco gira.
          </p>
          <p>
            <strong className="text-cream">Record Store Day</strong> marca os
            lançamentos feitos para as duas datas anuais que abastecem lojas
            independentes; são as tiragens que somem mais rápido e as que mais
            oscilam de preço depois.{" "}
            <strong className="text-cream">Edição de aniversário</strong> e{" "}
            <strong className="text-cream">edição deluxe</strong> costumam trazer
            remasterização, faixas extras ou um encarte maior, e{" "}
            <strong className="text-cream">box set</strong> reúne vários discos numa
            caixa única.
          </p>
          <p>
            A classificação vem da descrição do produto e da ficha do Discogs, não de
            um campo declarado pela loja. Cada página lista o que está disponível na
            Amazon Brasil agora, com o preço acompanhado todo dia e o gráfico de 12
            meses — útil justamente aqui, onde a tiragem fechada faz o preço subir
            depois do lançamento em vez de cair.
          </p>
        </div>
      </section>
    </div>
  );
}
