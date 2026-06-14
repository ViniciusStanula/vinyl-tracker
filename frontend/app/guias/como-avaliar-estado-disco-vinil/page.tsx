import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

function IconChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 5.5L7 9.5L11 5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";
const SLUG = "como-avaliar-estado-disco-vinil";
const PAGE_TITLE = "Como Avaliar o Estado de um Disco de Vinil";
const PAGE_DESC =
  "Guia Goldmine de grading: o que significa Mint, NM, VG+, VG e Poor, como inspecionar disco e capa, abreviações do Discogs e como o grading afeta o preço.";
const DATE = "2026-05-31";
const DATE_MODIFIED = "2026-06-09";
const HERO_IMAGE = `${SITE_URL}/blog/inspecao-estado-disco-vinil.jpg`;

export const metadata: Metadata = {
  title: "Como Avaliar o Estado de um Disco de Vinil | Garimpa Vinil",
  description: PAGE_DESC,
  alternates: { canonical: `/guias/${SLUG}` },
  openGraph: {
    type: "article",
    title: PAGE_TITLE,
    description: PAGE_DESC,
    url: `/guias/${SLUG}`,
    images: [
      {
        url: HERO_IMAGE,
        width: 1200,
        height: 800,
        alt: "Mãos segurando disco de vinil pelas bordas para inspeção do estado de conservação",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESC,
    images: [HERO_IMAGE],
  },
};

const TOC = [
  { id: "sistema-goldmine", label: "O sistema Goldmine e como ele funciona" },
  { id: "graus-do-vinil", label: "Os graus do vinil: do Mint ao Poor" },
  { id: "avaliar-capa", label: "Como avaliar a capa separada do disco" },
  { id: "inspecionar", label: "Como inspecionar um disco na prática" },
  { id: "abreviacoes", label: "Abreviações do Discogs e dos sebos brasileiros" },
  { id: "grading-inflation", label: "Grading inflation: o problema de confiar só na descrição" },
  { id: "grading-preco", label: "Como o grading se traduz em preço" },
  { id: "faq", label: "Perguntas frequentes" },
];

const GRADES = [
  {
    abbr: "M",
    name: "Mint",
    color: "text-gold",
    border: "border-gold/40",
    vinil:
      "Superfície absolutamente perfeita: brilho de fábrica em todos os ângulos, sem qualquer marca, risco ou impressão digital. Selo central perfeito e bem centrado.",
    capa:
      "Lacrada ou absolutamente intocada: cantos afiados, sem ring wear, sem marcas de manuseio, sem nenhuma imperfeição.",
    pratica:
      "Se não está lacrado, desconfie de qualquer M na etiqueta. O guia oficial da Goldmine diz que esse grau só deve ser atribuído quando mais de uma pessoa concorda que o disco realmente está nessa condição. Na prática, M não selado praticamente não existe.",
  },
  {
    abbr: "NM",
    name: "Near Mint",
    color: "text-patina",
    border: "border-patina/40",
    vinil:
      "Marcas visíveis apenas sob luz direta e oblíqua, nunca a olho nu em luz normal. Nenhum risco perceptível ao toque. Brilho quase intacto. Zero ruído de fundo durante a reprodução.",
    capa:
      "Cantos levemente amolecidos no máximo. Sem ring wear, sem escrita, sem rasgos, sem adesivos. Praticamente intocada.",
    pratica:
      "Referência do mercado: todos os percentuais de preço partem do NM. Um disco novo comprado em loja e tocado uma ou duas vezes com cuidado chega aqui. Se você está pagando preço premium, isso é o mínimo que deveria receber.",
  },
  {
    abbr: "VG+",
    name: "Very Good Plus",
    color: "text-cream",
    border: "border-groove",
    vinil:
      "Marcas leves visíveis em ângulo oblíquo. Pode ter um tick quase inaudível em passagens completamente silenciosas. Sem riscos profundos, sem pulos, sem empenamento.",
    capa:
      "Ring wear muito leve possível. Desgaste mínimo nas bordas. Sem escrita, sem rasgos de costura, sem adesivos.",
    pratica:
      "O ponto ideal para quem compra para ouvir. Representa 55 a 70% do preço NM e é onde mora a maioria das boas compras em sebo. Limpo e bem conservado, VG+ é suficiente para 99% das audições.",
  },
  {
    abbr: "VG",
    name: "Very Good",
    color: "text-parchment",
    border: "border-groove",
    vinil:
      "Riscos leves visíveis sem precisar de ângulo. Ruído de fundo audível durante toda a reprodução. Pode ter groove wear leve nas faixas mais pesadas.",
    capa:
      "Ring wear evidente. Possível risco de costura pequeno (menos de 1 cm). Desgaste visível nas bordas. A capa funciona mas mostra a idade.",
    pratica:
      "Vale 25 a 35% do NM. Você vai ouvir a diferença em qualquer sistema. Ainda aproveitável para audição casual ou para títulos difíceis de encontrar em melhor estado. Sempre que possível, escute antes de comprar.",
  },
  {
    abbr: "G",
    name: "Good / Good Plus",
    color: "text-dust",
    border: "border-groove",
    vinil:
      "Riscos claramente visíveis sem qualquer esforço. Groove wear pesado. Ruído constante e significativo. Distorção em passagens de volume alto.",
    capa:
      "Ring wear pesado. Rasgos de costura maiores. Escrita ou adesivos possíveis. Pode estar incompleta.",
    pratica:
      "Vale 5 a 20% do NM. Compre apenas por raridade extrema ou como substituto temporário enquanto busca cópia melhor. Audição antes de qualquer compra é indispensável nessa faixa.",
  },
  {
    abbr: "F / P",
    name: "Fair / Poor",
    color: "text-red-400",
    border: "border-red-400/30",
    vinil:
      "Sulcos profundos, empenamento severo, possíveis rachaduras. Fair pula em múltiplos pontos; Poor está além de qualquer reprodução razoável.",
    capa:
      "Pode estar incompleta ou completamente ausente.",
    pratica:
      "Valor residual apenas em títulos raríssimos. Para display, para coleção por completismo, nunca para audição real.",
  },
];

const ABBREVIATIONS = [
  { abbr: "SS", desc: "Still Sealed. Lacrado de fábrica, nunca aberto." },
  { abbr: "EX", desc: "Excellent. Convenção europeia fora do padrão Goldmine oficial. Equivale a NM ou alto VG+ dependendo do vendedor." },
  { abbr: "NM-", desc: "Near Mint Minus. Informal, não oficial. Sinaliza que está abaixo do NM mas acima de VG+." },
  { abbr: "OG", desc: "Original. Prensagem original, não reissue." },
  { abbr: "RE", desc: "Reissue. Reedição, não a prensagem original." },
  { abbr: "RM", desc: "Remaster. Disco remasterizado." },
  { abbr: "GF", desc: "Gatefold. Capa dupla abrível." },
  { abbr: "WOC", desc: "Writing on Cover. Escrita na frente da capa (nome, preço, etc.)." },
  { abbr: "WOBC", desc: "Writing on Back Cover. Escrita no verso da capa." },
  { abbr: "WOL", desc: "Writing on Label. Escrita no selo central do disco." },
  { abbr: "SOC", desc: "Sticker on Cover. Adesivo na frente da capa." },
  { abbr: "CC", desc: "Cut Corner. Canto da capa cortado pela distribuidora (retirada de circulação)." },
  { abbr: "SM", desc: "Saw Mark. Marca de serra na capa ou no disco (retirada de circulação)." },
  { abbr: "DH", desc: "Drill Hole. Furo de broca no disco ou na capa (retirada de circulação)." },
  { abbr: "NS", desc: "No Sleeve. Sem a capa interna original." },
  { abbr: "OIS", desc: "Original Inner Sleeve. Sleeve interno original incluído." },
  { abbr: "OBI", desc: "Faixa lateral japonesa (obi-strip). Característica de prensagens do Japão." },
  { abbr: "Promo", desc: "Cópia promocional. Pode ter marcas, punch holes ou selos de promo." },
];

const FAQ = [
  {
    q: "Mint e Near Mint são a mesma coisa?",
    a: "Não. Mint é teoricamente perfeito em absolutamente todos os aspectos, um grau que o guia oficial da Goldmine diz que raramente existe fora de cópias lacradas. Near Mint é o teto prático do mercado: disco que parece recém-comprado, com marcas mínimas visíveis só sob luz direta, e zero ruído de fundo durante a reprodução. Na prática, NM é o que você busca quando quer o melhor.",
  },
  {
    q: "O que significa VG+ no Discogs?",
    a: "No Discogs, VG+ (Very Good Plus) descreve um disco com marcas leves visíveis em ângulo oblíquo que não afetam a audição de forma perceptível. Pode ter um tick esporádico numa passagem completamente silenciosa, mas toca sem ruído constante e sem pulos. É o grau mais comum nas vendas de Discogs e representa o equilíbrio entre qualidade e custo para quem compra para ouvir.",
  },
  {
    q: "Preciso limpar o disco antes de avaliar o estado?",
    a: "Sim, para qualquer avaliação séria. Poeira e oleosidade acumuladas mascaram a condição real do vinil: o que parece um risco pode ser sujeira impregnada, e vice-versa. Limpe com escova de fibra de carbono antes da inspeção visual e com água destilada e sabão neutro antes de qualquer avaliação definitiva. Um disco sujo gradado como VG pode ser VG+ depois de limpo.",
  },
  {
    q: "O que fazer quando o grading do vendedor parece inflado?",
    a: "Peça fotos sob luz direta e oblíqua antes de qualquer compra relevante. Vendedor sério não tem problema em mandar. Verifique também o histórico de feedback do vendedor no Discogs, especificamente nos comentários sobre condição dos itens recebidos. Em sebo, inspecione você mesmo antes de fechar. Se o vendedor não deixa ver o disco na luz, é sinal ruim.",
  },
  {
    q: "EX (Excellent) é o mesmo que NM?",
    a: "EX é uma convenção europeia que não faz parte do padrão Goldmine oficial nem do Discogs. Na prática, EX costuma equivaler a NM ou alto VG+, mas depende do vendedor. No Discogs, a escala oficial é M, NM, VG+, VG, G+, G, F e P. Quando encontrar EX numa listagem, pergunte ao vendedor como ele define o grau antes de comprar.",
  },
  {
    q: "Como o grading da capa afeta o preço se o disco está ótimo?",
    a: "Depende do perfil do comprador. Quem compra só para ouvir liga menos para a capa. Quem coleciona com atenção ao conjunto completo paga mais por capa em bom estado. Em geral, um disco NM numa capa VG vale menos do que o mesmo disco NM numa capa NM. No Discogs, o padrão é informar os dois separadamente (ex.: Media NM / Sleeve VG+) justamente para o comprador poder julgar os dois lados.",
  },
];

export default function GradingPage() {
  const articleLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: PAGE_TITLE,
    description: PAGE_DESC,
    datePublished: DATE,
    dateModified: DATE_MODIFIED,
    inLanguage: "pt-BR",
    articleSection: "Guias",
    keywords: "grading vinil, avaliar estado disco vinil, Mint NM VG+ VG Good Poor, Goldmine grading, Discogs grading",
    author: { "@type": "Person", "@id": `${SITE_URL}/sobre#person`, name: "Vinicius Stanula", url: `${SITE_URL}/sobre`, sameAs: ["https://linkedin.com/in/vinicius-stanula"] },
    publisher: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "Garimpa Vinil" },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/guias/${SLUG}` },
    image: {
      "@type": "ImageObject",
      url: HERO_IMAGE,
      width: 1200,
      height: 800,
    },
    speakable: { "@type": "SpeakableSpecification", cssSelector: ["h1"] },
  });

  const breadcrumbLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Guias", item: `${SITE_URL}/guias` },
      { "@type": "ListItem", position: 3, name: "Como Avaliar o Estado de um Disco de Vinil", item: `${SITE_URL}/guias/${SLUG}` },
    ],
  });

  const faqLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  });

  return (
    <main id="main-content" className="vinil-sidebar-layout mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqLd }} />

      {/* Breadcrumb */}
      <nav aria-label="Navegação estrutural" className="mb-6 text-sm text-dust flex gap-2 flex-wrap">
        <Link href="/" className="hover:text-gold transition-colors">Início</Link>
        <span aria-hidden="true">›</span>
        <Link href="/guias" className="hover:text-gold transition-colors">Guias</Link>
        <span aria-hidden="true">›</span>
        <span className="text-parchment">Como Avaliar o Estado de um Disco</span>
      </nav>

      {/* Hero */}
      <header className="relative mb-8 overflow-hidden rounded-2xl bg-sleeve border border-groove px-6 py-7 vinyl-grooves">
        <span className="text-xs font-semibold border rounded-full px-2.5 py-0.5 text-deallit border-deal/30 bg-deal/10 mb-4 inline-block">
          Guia
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-black text-cream leading-tight mb-3 [text-wrap:balance]">
          Como Avaliar o Estado de um{" "}
          <span className="text-gold">Disco de Vinil</span>
        </h1>
        <p className="text-parchment text-sm max-w-2xl leading-relaxed">
          Do Mint ao Poor: o que cada grau significa na prática, como inspecionar disco e capa
          separadamente, as abreviações do Discogs e como o estado afeta o preço.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-dust">
          <span>
            Publicado em{" "}
            <time dateTime={DATE} className="text-parchment">
              31 de maio de 2026
            </time>
          </span>
          <span>
            Atualizado em{" "}
            <time dateTime={DATE_MODIFIED} className="text-parchment">
              9 de junho de 2026
            </time>
          </span>
          <span className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.25" />
              <path d="M6 3.5V6.5L7.5 8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            </svg>
            Leitura: ~14 min
          </span>
        </div>
      </header>

      {/* Hero image */}
      <figure className="mb-8 rounded-2xl overflow-hidden">
        <Image
          src="/blog/inspecao-estado-disco-vinil.jpg"
          alt="Mãos segurando disco de vinil pelas bordas para inspeção do estado de conservação sob luz"
          width={1200}
          height={800}
          className="w-full object-cover max-h-96"
          priority
        />
      </figure>

      {/* Table of Contents */}
      <nav aria-label="Índice do artigo" className="bg-sleeve border border-groove rounded-xl p-5 mb-8">
        <p className="font-display text-sm font-bold text-cream mb-3">Neste guia</p>
        <ol className="space-y-1.5">
          {TOC.map((item, i) => (
            <li key={item.id} className="flex gap-2 items-baseline">
              <span className="text-xs text-dust w-4 shrink-0">{i + 1}.</span>
              <a href={`#${item.id}`} className="text-sm text-parchment hover:text-gold transition-colors">
                {item.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-10">

        {/* Intro */}
        <div className="space-y-4 text-parchment text-base leading-relaxed">
          <p>
            Você vai a um sebo, encontra o LP que procurava há meses e a capa diz &quot;VG+&quot;. A pergunta
            imediata é: esse VG+ é honesto? E se for, o que exatamente você vai ouvir quando colocar
            o disco para tocar?
          </p>
          <p>
            O sistema de grading existe exatamente para evitar essa incerteza. Quando funciona bem,
            comprador e vendedor falam a mesma língua. Quando o vendedor usa o grading de forma
            generosa, você paga mais do que o estado real do disco justificaria. Entender o sistema
            por dentro protege nas duas pontas: na hora de comprar e na hora de vender.
          </p>
          <p>
            O padrão universal é o Goldmine, publicação americana de colecionismo de discos que
            codificou as definições de grading a partir da década de 1970. O{" "}
            <a
              href="https://www.discogs.com/selling/resources/how-to-grade-items/"
              rel="nofollow noopener noreferrer"
              target="_blank"
              className="underline hover:text-gold transition-colors"
            >
              Discogs adota o mesmo padrão
            </a>{" "}
            com pequenas adaptações. Lojas, sebos e vendedores independentes em todo o Brasil usam
            esse vocabulário, mesmo sem saber que se chama Goldmine.
          </p>
        </div>

        {/* 1 */}
        <section id="sistema-goldmine">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            O Sistema Goldmine e Como Ele Funciona
          </h2>
          <div className="space-y-4 text-parchment text-base leading-relaxed">
            <p>
              A escala{" "}
              <a
                href="https://www.goldminemag.com/collector-resources/record-grading/record-grading-101/"
                rel="nofollow noopener noreferrer"
                target="_blank"
                className="underline hover:text-gold transition-colors"
              >
                Goldmine
              </a>{" "}
              tem oito graus: Mint (M), Near Mint (NM), Very Good Plus (VG+), Very Good (VG),
              Good Plus (G+), Good (G), Fair (F) e Poor (P). Na prática, a maioria das transações
              acontece entre NM e VG. M praticamente não existe fora de cópias lacradas, e F/P só
              aparecem em casos extremos.
            </p>
            <p>
              O sistema avalia dois elementos separados: o disco (chamado de &quot;media&quot; em inglês) e
              a capa (sleeve). Você vai encontrar vendas descritas assim: &quot;Media: VG+ / Sleeve: VG&quot;.
              Isso significa que o disco está em Very Good Plus mas a capa está em Very Good. São
              avaliações independentes porque afetam o valor de formas independentes.
            </p>
          </div>

          <div className="mt-6">
            <h3 className="font-display text-base font-bold text-cream mb-3">
              Disco e Capa São Avaliados Sempre em Separado
            </h3>
            <div className="space-y-3 text-parchment text-base leading-relaxed">
              <p>
                Um disco pode estar em condição quase perfeita dentro de uma capa destruída. O
                inverso também acontece. Os dois têm valor próprio e importam para públicos
                diferentes: o audiófilo que compra para ouvir se preocupa mais com o disco; o
                colecionador que busca peça completa e rara se preocupa com os dois.
              </p>
              <p>
                Quando uma listagem informa só um grau sem especificar qual é o disco e qual é a
                capa, é um sinal de que o vendedor está sendo preguiçoso com a descrição. Em compras
                online de qualquer valor significativo, sempre pergunte os dois separadamente antes
                de fechar.
              </p>
            </div>
          </div>
        </section>

        {/* 2 */}
        <section id="graus-do-vinil">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Os Graus do Vinil: do Mint ao Poor
          </h2>
          <p className="text-parchment text-sm leading-relaxed mb-6 bg-sleeve border border-groove rounded-xl px-4 py-3">
            Cada grau abaixo descreve o disco (media) primeiro e a capa (sleeve) em seguida.
            A coluna &quot;Na prática&quot; é o que você realmente precisa saber no momento da compra.
          </p>
          <div className="space-y-4">
            {GRADES.map(({ abbr, name, color, border, vinil, capa, pratica }) => (
              <div key={abbr} className={`bg-sleeve border ${border} rounded-xl p-5`}>
                <div className="flex items-start gap-4 mb-4">
                  <div className={`font-display text-2xl font-black ${color} shrink-0 w-12 text-center`}>
                    {abbr}
                  </div>
                  <div>
                    <p className={`font-display text-base font-bold ${color}`}>{name}</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-3 text-xs text-parchment">
                  <div>
                    <p className="font-semibold text-cream mb-1">No disco</p>
                    <p className="leading-relaxed">{vinil}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-cream mb-1">Na capa</p>
                    <p className="leading-relaxed">{capa}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-cream mb-1">Na prática</p>
                    <p className="leading-relaxed">{pratica}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3 */}
        <section id="avaliar-capa">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Como Avaliar a Capa Separada do Disco
          </h2>
          <figure className="mb-6 rounded-xl overflow-hidden">
            <Image
              src="/blog/capas-discos-vinil-sebo.jpg"
              alt="Capas de discos de vinil em estante de sebo ou feira, com desgaste visível nas bordas"
              width={800}
              height={533}
              className="w-full object-cover max-h-72"
            />
            <figcaption className="text-xs text-dust mt-2 px-1">
              A capa tem uma vida própria separada do disco. Ring wear, rasgos de costura e escrita são os defeitos mais comuns.
            </figcaption>
          </figure>
          <div className="space-y-4 text-parchment text-base leading-relaxed">
            <p>
              Capas envelhecem de formas específicas e a maioria dos defeitos tem nome. Conhecer esses
              termos é útil tanto para entender o que o vendedor está descrevendo quanto para descrever
              com precisão quando você for vender.
            </p>
          </div>

          <div className="mt-5">
            <h3 className="font-display text-base font-bold text-cream mb-3">
              Ring Wear, Seam Split e Outros Defeitos da Capa
            </h3>
            <div className="space-y-4">
              {[
                {
                  title: "Ring wear",
                  text: "O efeito granulado em forma de anel que o próprio disco imprime na capa quando guardado sem sleeve interno, especialmente em condições de pressão ou umidade. Ring wear leve é quase universal em capas com anos de uso. Ring wear pesado e profundo indica armazenamento descuidado por muito tempo.",
                },
                {
                  title: "Seam split",
                  text: "A costura lateral da capa se abre ou descola. Splits pequenos (menos de 1 cm) são considerados defeitos menores. Splits que percorrem um lado inteiro comprometem a estrutura da capa e fazem o disco escorregar. Capas dos anos 70 e 80 feitas com cola ao invés de grampo são especialmente propensas a isso.",
                },
                {
                  title: "Escrita na capa (WOC)",
                  text: "Nome do dono, preço de sebo, data de compra escrito diretamente na capa. Reduz o valor para colecionadores mas não importa para quem compra só para ouvir. A abreviação WOC (Writing on Cover) aparece frequentemente nas listagens do Discogs.",
                },
                {
                  title: "Adesivos e stickers (SOC)",
                  text: "Etiquetas de preço, selos de promo, adesivos de sebo grudados na capa. Alguns saem sem deixar marca, outros arrancam parte do papelão. Antes de comprar, pergunte se há adesivo e se já foi testada a remoção.",
                },
                {
                  title: "CC, SM e DH: marcas de retirada de circulação",
                  text: "CC (Cut Corner), SM (Saw Mark) e DH (Drill Hole) são marcas feitas pela distribuidora para indicar que o disco foi retirado de circulação sem ser vendido no varejo. Não afetam o disco em si, mas reduzem o valor colecionável. DH no disco (não apenas na capa) é o mais problemático.",
                },
              ].map(({ title, text }) => (
                <div key={title} className="bg-sleeve border border-groove rounded-xl p-4">
                  <p className="font-semibold text-cream text-sm mb-2">{title}</p>
                  <p className="text-parchment text-sm leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4 */}
        <section id="inspecionar">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Como Inspecionar um Disco na Prática
          </h2>
          <p className="text-parchment text-sm leading-relaxed mb-5 bg-sleeve border border-groove rounded-xl px-4 py-3">
            Nenhum grading honesto acontece em luz ambiente de teto. Você precisa de uma fonte de
            luz direta, discernimento sobre o tipo de marca que está vendo, e o toque da própria
            mão para confirmar a profundidade do que seus olhos encontram.
          </p>

          <div className="space-y-6">
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                A Técnica da Luz Oblíqua
              </h3>
              <div className="space-y-4 text-parchment text-base leading-relaxed">
                <p>
                  Segure o disco pelas bordas e incline-o a aproximadamente 45 graus em relação a
                  uma fonte de luz forte e direta. Uma lâmpada LED ou incandescente comum funciona
                  bem. Luz difusa de teto não funciona porque não cria o ângulo rasante necessário.
                </p>
                <p>
                  Gire o disco devagar, examinando cada quadrante dos dois lados. Marcas que seriam
                  completamente invisíveis em luz frontal aparecem com clareza quando a luz rasante
                  as intercepta. Essa é a única forma de avaliar o estado real do vinil com honestidade.
                  Qualquer grading feito sem esse procedimento é estimativa.
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Riscos, Scuffs e Hairlines: a Diferença Importa
              </h3>
              <figure className="mb-4 rounded-xl overflow-hidden">
                <Image
                  src="/blog/superficie-disco-vinil-poeira.jpg"
                  alt="Superfície de disco de vinil sob luz direta, mostrando partículas e marcas visíveis nos sulcos"
                  width={800}
                  height={1200}
                  className="w-full object-cover max-h-64"
                />
                <figcaption className="text-xs text-dust mt-2 px-1">
                  Sob luz oblíqua, as marcas na superfície aparecem com clareza. O tipo de marca determina o grau.
                </figcaption>
              </figure>
              <div className="grid sm:grid-cols-3 gap-3 text-parchment text-sm">
                {[
                  {
                    label: "Hairline",
                    nota: "NM ou alto VG+",
                    notaColor: "text-patina",
                    desc: "Marca finíssima, visível apenas sob luz direta em ângulo muito específico. Não afeta a reprodução. Comuns mesmo em discos muito bem conservados.",
                  },
                  {
                    label: "Scuff",
                    nota: "VG+",
                    notaColor: "text-cream",
                    desc: "Marca mais larga e superficial, geralmente causada pelo disco deslizando dentro ou fora do sleeve. Pode produzir um tick muito leve em passagens completamente silenciosas.",
                  },
                  {
                    label: "Risco (scratch)",
                    nota: "VG ou abaixo",
                    notaColor: "text-parchment",
                    desc: "Marca perceptível ao toque. Quanto mais profundo, mais audível. Riscos que atravessam vários sulcos causam cliques repetidos na reprodução.",
                  },
                ].map(({ label, nota, notaColor, desc }) => (
                  <div key={label} className="bg-sleeve border border-groove rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-cream text-xs">{label}</p>
                      <span className={`text-xs font-medium ${notaColor}`}>{nota}</span>
                    </div>
                    <p className="text-xs leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                O Teste da Unha
              </h3>
              <div className="space-y-3 text-parchment text-base leading-relaxed">
                <p>
                  Depois de identificar uma marca visualmente, passe a ponta da sua unha
                  delicadamente sobre ela. Essa confirmação tátil resolve a maioria das dúvidas na
                  hora do grading:
                </p>
                <div className="space-y-2">
                  {[
                    { cond: "Não sente nada", grade: "Hairline ou scuff superficial", hint: "Território NM ou alto VG+" },
                    { cond: "Sente levemente, precisa prestar atenção", grade: "Risco leve", hint: "Alto VG ou baixo VG+" },
                    { cond: "Sente claramente sem forçar", grade: "Risco médio a profundo", hint: "VG ou abaixo" },
                    { cond: "Consegue enganchar a unha", grade: "Risco profundo", hint: "G+ ou G, audição comprometida" },
                  ].map(({ cond, grade, hint }) => (
                    <div key={cond} className="flex gap-3 text-sm items-start bg-sleeve border border-groove rounded-lg px-4 py-3">
                      <div className="flex-1">
                        <span className="text-cream font-medium">{cond}:</span>{" "}
                        <span className="text-parchment">{grade}</span>
                      </div>
                      <span className="text-dust text-xs shrink-0 mt-0.5">{hint}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5 */}
        <section id="abreviacoes">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Abreviações do Discogs e dos Sebos Brasileiros
          </h2>
          <p className="text-parchment text-base leading-relaxed mb-5">
            Listagens no Discogs e em lojas mais cuidadosas usam abreviações padronizadas para
            descrever defeitos específicos sem precisar escrever um parágrafo. Conhecer esse
            vocabulário evita surpresas na hora da entrega.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {ABBREVIATIONS.map(({ abbr, desc }) => (
              <div key={abbr} className="bg-sleeve border border-groove rounded-xl p-4 flex gap-3">
                <span className="font-display text-sm font-bold text-gold shrink-0 w-14">{abbr}</span>
                <p className="text-parchment text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <p className="text-dust text-xs leading-relaxed mt-4">
            Lista completa de abreviações aceitas no{" "}
            <a
              href="https://support.discogs.com/hc/en-us/articles/360001566193-How-To-Grade-Items"
              rel="nofollow noopener noreferrer"
              target="_blank"
              className="underline hover:text-gold transition-colors"
            >
              guia oficial de grading do Discogs
            </a>
            .
          </p>
        </section>

        {/* 6 */}
        <section id="grading-inflation">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Grading Inflation: o Problema de Confiar Só na Descrição
          </h2>
          <div className="space-y-4 text-parchment text-base leading-relaxed">
            <p>
              Grading inflation é o fenômeno de o vendedor avaliar o disco um grau acima do que um
              comprador experiente avaliaria. Não é necessariamente desonestidade: muita gente
              genuinamente não sabe onde está a linha entre VG+ e NM, ou entre VG e VG+. O resultado
              é o mesmo: você paga preço de NM e recebe VG+, ou paga preço de VG+ e recebe VG.
            </p>
            <p>
              O guia do Discogs instrui vendedores a graduar de forma conservadora: em caso de
              dúvida, use o grau mais baixo. Na prática, isso nem sempre acontece, especialmente
              em vendedores com menos experiência ou em sebos que classificam por impressão geral.
            </p>
            <p>
              Como se proteger:
            </p>
            <div className="space-y-3">
              {[
                {
                  title: "Peça fotos sob luz direta e oblíqua",
                  text: "Antes de qualquer compra online acima de um valor que você se importaria de perder, peça imagens do disco inclinado contra uma fonte de luz. Vendedor sério não tem problema em mandar. Quem reluta tem algo a esconder ou simplesmente não sabe como tirar.",
                },
                {
                  title: "Leia o histórico de feedback com atenção",
                  text: "No Discogs, os comentários de feedback de compras anteriores frequentemente mencionam grading. Procure especificamente por reclamações sobre condição. Um histórico longo sem nenhuma reclamação de grading inflado é um bom sinal.",
                },
                {
                  title: "Em sebo, inspecione você mesmo",
                  text: "Leve o disco até a luz. Nenhum vendedor honesto vai impedir você de examinar o que está comprando. Se o vendedor fica nervoso com uma inspeção simples, isso é informação.",
                },
                {
                  title: "Compre de vendedores com histórico longo",
                  text: "Quem vende regularmente no Discogs há anos tem reputação construída e muito mais a perder com um grading ruim do que um vendedor eventual. Não é garantia, mas é um filtro razoável.",
                },
              ].map(({ title, text }) => (
                <div key={title} className="bg-sleeve border border-groove rounded-xl p-4">
                  <p className="font-semibold text-cream text-sm mb-2">{title}</p>
                  <p className="text-parchment text-sm leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7 */}
        <section id="grading-preco">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Como o Grading se Traduz em Preço
          </h2>
          <p className="text-parchment text-base leading-relaxed mb-5">
            O NM é o grau de referência do mercado: todos os percentuais partem dele. O que você
            vê abaixo é a faixa típica praticada no mercado internacional de colecionismo; no mercado
            brasileiro, o Discogs é a melhor ferramenta para verificar o preço médio real de um título
            específico por grau.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { grade: "M / SS", pct: "150%+", note: "Cópias lacradas raras podem valer muito mais" },
              { grade: "NM", pct: "100%", note: "Referência do mercado" },
              { grade: "VG+", pct: "55–70%", note: "Melhor custo-benefício para ouvir" },
              { grade: "VG", pct: "25–35%", note: "Ainda aproveitável com expectativa calibrada" },
              { grade: "G+ / G", pct: "5–20%", note: "Só pela raridade do título" },
              { grade: "F / P", pct: "Residual", note: "Valor simbólico ou para peças únicas" },
            ].map(({ grade, pct, note }) => (
              <div key={grade} className="bg-sleeve border border-groove rounded-xl p-4 text-center">
                <p className="font-display text-sm font-bold text-cream mb-0.5">{grade}</p>
                <p className="text-gold font-bold text-lg mb-1">{pct}</p>
                <p className="text-dust text-xs leading-relaxed">{note}</p>
              </div>
            ))}
          </div>
          <p className="text-dust text-xs leading-relaxed mt-4">
            Faixas de preço por grau baseadas no{" "}
            <a
              href="https://vinyliq.com/record-grading/"
              rel="nofollow noopener noreferrer"
              target="_blank"
              className="underline hover:text-gold transition-colors"
            >
              guia de grading do Vinyl IQ
            </a>
            . No Discogs, use a aba &quot;Statistics&quot; de cada release para ver o preço médio real por grau.
          </p>
        </section>

        {/* 8 — FAQ */}
        <section id="faq">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Perguntas Frequentes Sobre Grading de Vinil
          </h2>
          <div className="space-y-4">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="bg-sleeve border border-groove rounded-xl group">
                <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none">
                  <span className="font-display text-sm font-bold text-cream">{q}</span>
                  <IconChevronDown className="text-gold shrink-0 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="px-5 pb-4 text-parchment text-base leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Conclusion */}
        <section>
          <div className="bg-sleeve border border-groove rounded-xl p-6">
            <h2 className="font-display text-lg font-bold text-cream mb-3">
              Saber Graduar é Saber Comprar
            </h2>
            <div className="space-y-3 text-parchment text-base leading-relaxed">
              <p>
                O grading não resolve tudo. Um VG+ honesto pode soar melhor do que um NM
                infladíssimo. Mas entender o sistema coloca você numa posição muito mais forte tanto
                para interpretar o que está comprando quanto para descrever com precisão o que está
                vendendo.
              </p>
              <p>
                Na prática: sempre peça os dois graus separados (disco e capa), sempre inspecione
                sob luz oblíqua quando possível, e use o teste da unha para confirmar o que seus
                olhos encontraram. Esses três hábitos resolvem 90% das surpresas desagradáveis. E
                limpe antes de avaliar: sujeira mascara a condição real. O passo a passo está no
                nosso{" "}
                <Link href="/guias/como-cuidar-de-discos-de-vinil" className="underline hover:text-gold transition-colors">
                  guia de limpeza e cuidados
                </Link>
                .
              </p>
              <p>
                E se ainda tiver dúvida depois de inspecionar: grade para baixo. Comprador que
                recebe algo melhor do que esperava volta a comprar. Comprador que recebe pior do que
                pagou não volta nunca.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/disco"
                className="inline-flex items-center gap-1.5 bg-gold/10 border border-gold/30 text-gold text-xs font-semibold px-4 py-2 rounded-full hover:bg-gold/20 transition-colors"
              >
                Ver discos com preço monitorado
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link
                href="/guias"
                className="inline-flex items-center gap-1.5 border border-groove text-parchment text-xs font-semibold px-4 py-2 rounded-full hover:border-patina transition-colors"
              >
                Ver todos os guias
              </Link>
            </div>
          </div>
        </section>

        {/* Related guides */}
        <section aria-label="Guias relacionados">
          <h2 className="font-display text-lg font-bold text-cream mb-4">Leia também</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { href: "/guias/como-cuidar-de-discos-de-vinil", title: "Como Cuidar de Discos de Vinil", desc: "Limpeza, armazenamento no clima do Brasil e os 5 erros que destroem coleções." },
              { href: "/guias/vinil-180g-vale-a-pena", title: "Vinil 180g Vale a Pena?", desc: "Original bem conservado ou reissue pesado? O que olhar antes de pagar mais." },
            ].map(({ href, title, desc }) => (
              <Link key={href} href={href} className="block bg-sleeve border border-groove rounded-xl p-4 hover:border-patina transition-colors">
                <p className="font-display text-sm font-bold text-cream mb-1">{title}</p>
                <p className="text-parchment text-xs leading-relaxed">{desc}</p>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
