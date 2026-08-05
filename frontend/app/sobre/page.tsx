import BackToTop from "@/components/BackToTop";
import Link from "next/link";

import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";

const personJsonLd = toJsonLd({
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": `${SITE_URL}/sobre#person`,
  name: "Vinicius Stanula",
  url: SITE_URL,
  sameAs: ["https://linkedin.com/in/vinicius-stanula"],
});

const breadcrumbJsonLd = toJsonLd({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Sobre", item: `${SITE_URL}/sobre` },
  ],
});

const faqJsonLd = toJsonLd({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "O que é o Garimpa Vinil?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "O Garimpa Vinil é um catálogo de discos de vinil disponíveis na Amazon Brasil, com histórico de preços de até 12 meses por disco. O objetivo é ajudar colecionadores e compradores a identificar o melhor momento para comprar, comparando o preço atual com a média e o mínimo histórico registrado.",
      },
    },
    {
      "@type": "Question",
      name: "Como o Garimpa Vinil obtém os preços?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Um crawler automatizado consulta a Amazon Brasil a cada 3 horas e registra o preço de cada disco em banco de dados próprio. Os dados são exclusivamente da Amazon Brasil. Ao clicar em 'Ver na Amazon', você é direcionado à página oficial do produto, onde o preço em tempo real é sempre o mais preciso.",
      },
    },
    {
      "@type": "Question",
      name: "O que significam os selos 'Melhor Preço', 'Ótima Oferta' e 'Boa Oferta'?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "'Melhor Preço' indica que o preço atual é o menor já registrado para aquele disco. 'Ótima Oferta' aparece quando o preço está abaixo da média histórica. 'Boa Oferta' indica desconto ativo em relação ao preço anterior, mas ainda acima da média histórica.",
      },
    },
    {
      "@type": "Question",
      name: "O Garimpa Vinil vende discos?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Não. O Garimpa Vinil é um agregador de preços e não vende discos diretamente. Todos os links levam à Amazon Brasil, onde a compra é finalizada. O site participa do programa de Associados Amazon, recebendo comissão sobre compras qualificadas sem custo adicional para o comprador.",
      },
    },
  ],
});

export const metadata = {
  title: "Sobre | Garimpa Vinil",
  description:
    "Conheça o Garimpa Vinil: quem fez, como funciona o rastreamento de preços de vinil na Amazon Brasil e como usar o histórico para comprar na hora certa.",
  alternates: { canonical: "/sobre" },
  openGraph: {
    title: "Sobre | Garimpa Vinil",
    description:
      "Conheça o Garimpa Vinil: quem fez, como funciona o rastreamento de preços de vinil na Amazon Brasil e como usar o histórico para comprar na hora certa.",
    url: "/sobre",
    type: "website",
    images: ["/og-default.png"],
  },
  twitter: {
    card: "summary",
    title: "Sobre | Garimpa Vinil",
    description:
      "Conheça o Garimpa Vinil: quem fez, como funciona o rastreamento de preços de vinil na Amazon Brasil e como usar o histórico para comprar na hora certa.",
  },
};

export default function SobrePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
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
          Um rastreador de preços de discos de vinil na Amazon Brasil. Mais de 33.000 títulos
          monitorados para você comprar no momento certo.
        </p>
      </header>

      {/* ── Quem fez ────────────────────────────────────────────── */}
      <section className="mb-6 bg-sleeve border border-groove rounded-xl p-6">
        <h2 className="font-display text-xl font-bold text-cream mb-3">
          Quem fez isso
        </h2>
        <p className="text-parchment text-sm leading-relaxed mb-3">
          Sou Vinicius Stanula, desenvolvedor e colecionador de vinil. Criei o Garimpa Vinil
          porque me cansei de comprar discos na Amazon e descobrir dias depois que o preço havia
          caído. Queria uma ferramenta que me dissesse se o preço atual era bom historicamente —
          e como ela não existia para o mercado brasileiro, construí.
        </p>
        <p className="text-parchment text-sm leading-relaxed">
          O site existe desde 2026 e cresce junto com o catálogo de vinil disponível na Amazon
          Brasil. Você pode me encontrar no{" "}
          <a
            href="https://linkedin.com/in/vinicius-stanula"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:underline"
          >
            LinkedIn
          </a>
          {" "}ou pelo canal do Telegram abaixo.
        </p>
      </section>

      {/* ── Como funciona ───────────────────────────────────────── */}
      <section className="mb-6 bg-sleeve border border-groove rounded-xl p-6">
        <h2 className="font-display text-xl font-bold text-cream mb-3">
          Como funciona o rastreamento
        </h2>
        <p className="text-parchment text-sm leading-relaxed mb-3">
          Um crawler automatizado consulta a Amazon Brasil a cada 3 horas e registra o preço
          de cada disco em banco de dados próprio. O histórico começa na data em que cada disco
          foi adicionado ao catálogo — alguns têm meses de dados, outros têm menos se foram
          incluídos recentemente.
        </p>
        <p className="text-parchment text-sm leading-relaxed mb-3">
          Com base nesses registros, calculamos três números que aparecem em cada página de disco:
        </p>
        <ul className="text-parchment text-sm leading-relaxed space-y-2 mb-3 list-none">
          <li className="flex gap-2">
            <span className="text-gold font-bold shrink-0">Atual</span>
            <span>— preço registrado na última consulta à Amazon.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-gold font-bold shrink-0">Mínimo</span>
            <span>— menor preço já registrado para aquele disco, com a data em que ocorreu.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-gold font-bold shrink-0">Média</span>
            <span>— média de todos os preços registrados nos últimos 12 meses.</span>
          </li>
        </ul>
        <p className="text-parchment text-sm leading-relaxed">
          O selo <span className="text-gold font-semibold">Melhor Preço</span> aparece quando o
          preço atual é o menor já registrado. <span className="text-gold font-semibold">Ótima
          Oferta</span> indica preço abaixo da média histórica.{" "}
          <span className="text-gold font-semibold">Boa Oferta</span> indica desconto ativo em
          relação ao preço anterior, ainda que acima da média.
        </p>
      </section>

      {/* ── Limitações ──────────────────────────────────────────── */}
      <section className="mb-6 bg-sleeve border border-groove rounded-xl p-6">
        <h2 className="font-display text-xl font-bold text-cream mb-3">
          O que o site não faz
        </h2>
        <p className="text-parchment text-sm leading-relaxed mb-3">
          O Garimpa Vinil não vende discos e não tem estoque. Todos os links levam à Amazon
          Brasil, onde a compra é finalizada e o preço em tempo real é sempre o mais preciso.
          O preço exibido aqui pode ter alguns minutos ou horas de defasagem em relação ao
          valor exato da Amazon no momento da sua visita.
        </p>
        <p className="text-parchment text-sm leading-relaxed">
          O catálogo cobre apenas discos disponíveis na Amazon Brasil. Sebos, feiras e outras
          lojas online não são rastreados.
        </p>
      </section>

      {/* ── Contato ─────────────────────────────────────────────── */}
      <section className="mb-6 bg-sleeve border border-groove rounded-xl p-6">
        <h2 className="font-display text-xl font-bold text-cream mb-3">
          Contato e comunidade
        </h2>
        <p className="text-parchment text-sm leading-relaxed mb-4">
          Para sugestões, erros ou qualquer dúvida, o melhor canal é o Telegram. Também publico
          lá as melhores ofertas do dia assim que são identificadas pelo crawler.
        </p>
        <a
          href="https://t.me/garimpavinil"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold text-record text-sm font-bold hover:bg-gold/90 transition-colors"
        >
          Canal do Telegram
        </a>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────── */}
      <section className="mb-6 bg-sleeve border border-groove rounded-xl p-6">
        <h2 className="font-display text-xl font-bold text-cream mb-4">
          Perguntas frequentes
        </h2>
        <div className="space-y-5">
          <div>
            <p className="text-cream text-sm font-semibold mb-1">
              O que significam os selos de oferta?
            </p>
            <p className="text-parchment text-sm leading-relaxed">
              <span className="text-gold font-semibold">Melhor Preço</span> = preço atual é o
              menor já registrado. <span className="text-gold font-semibold">Ótima Oferta</span>
              {" "}= preço abaixo da média histórica. <span className="text-gold font-semibold">
              Boa Oferta</span> = desconto ativo em relação ao preço anterior.
            </p>
          </div>
          <div>
            <p className="text-cream text-sm font-semibold mb-1">
              Com que frequência os preços são atualizados?
            </p>
            <p className="text-parchment text-sm leading-relaxed">
              O crawler roda a cada 3 horas. Promoções relâmpago da Amazon podem aparecer e
              desaparecer entre uma consulta e outra. Ao clicar em "Ver na Amazon", o preço
              exibido na Amazon é sempre o mais atual.
            </p>
          </div>
          <div>
            <p className="text-cream text-sm font-semibold mb-1">
              O site ganha comissão nas compras?
            </p>
            <p className="text-parchment text-sm leading-relaxed">
              Sim. O Garimpa Vinil participa do Programa de Associados Amazon Brasil. Ao comprar
              pela Amazon usando nossos links, recebemos uma pequena comissão sem custo adicional
              para você. Isso financia a infraestrutura do site.
            </p>
          </div>
          <div>
            <p className="text-cream text-sm font-semibold mb-1">
              Posso sugerir um disco para ser adicionado?
            </p>
            <p className="text-parchment text-sm leading-relaxed">
              O catálogo é construído automaticamente a partir das categorias de vinil da Amazon
              Brasil. Se um disco está disponível na Amazon e ainda não aparece aqui, é provável
              que o crawler ainda não o tenha indexado. Entre em contato pelo Telegram se quiser
              reportar ausências específicas.
            </p>
          </div>
        </div>
      </section>

      <BackToTop />
    </div>
  );
}
