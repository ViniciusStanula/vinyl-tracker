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
const SLUG = "vinil-colorido-e-picture-disc";
const PAGE_TITLE = "Vinil Colorido e Picture Disc Valem a Pena?";
const PAGE_DESC =
  "Colorido soa pior que preto? E picture disc? Mito vs. realidade técnica: carbon black, polietileno, splatter e quando cada formato vale a pena comprar.";
const DATE = "2026-06-01";
const DATE_MODIFIED = "2026-06-25";
const HERO_IMAGE = `${SITE_URL}/blog/vinil-colorido-close.jpg`;

export const metadata: Metadata = {
  title: "Vinil Colorido e Picture Disc Valem a Pena? | Garimpa Vinil",
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
        alt: "Disco de vinil colorido em close, evidenciando a superfície e os sulcos de uma prensagem em cor",
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
  { id: "reputacao", label: "Por que o preto tem vantagem histórica" },
  { id: "tipos", label: "Sólido, transparente, splatter e marble: comportamentos diferentes" },
  { id: "picture-disc", label: "O caso separado do picture disc" },
  { id: "quando-colorido", label: "Quando comprar colorido faz sentido" },
  { id: "quando-picture-disc", label: "Quando picture disc faz sentido e quando não faz" },
  { id: "faq", label: "Perguntas frequentes" },
];

const FAQ = [
  {
    q: "Vinil colorido desgasta a agulha mais rápido que o preto?",
    a: "Colorido sólido de boa qualidade não. O desgaste da agulha depende principalmente da rugosidade da superfície e da consistência dos sulcos, não da cor. Picture disc é a exceção: o polietileno do foil degrada com o uso e com o tempo, e uma superfície progressivamente deteriorada causa mais vibração sobre o stylus. Para uso regular, picture disc não é recomendado.",
  },
  {
    q: "Existe algum picture disc que soa bem?",
    a: "Sim, picture discs modernos prensados em plantas de alta qualidade com boa laminação soam notavelmente melhor do que os das décadas de 70 e 80. Para audição casual o resultado pode ser aceitável. Mas o teto sonoro de um picture disc moderno ainda está abaixo do que uma prensagem padrão equivalente entrega. Compre para exibir, ouça a versão preta.",
  },
  {
    q: "Transparente é melhor ou pior que colorido sólido?",
    a: "Muito similar. O vinil transparente usa agentes clareadores ao invés do carbon black que torna o disco preto. É levemente mais sensível à degradação por UV do que o preto, mas sonicamente muito próximo do colorido sólido de boa qualidade. Nenhuma desvantagem prática para quem cuida bem do armazenamento.",
  },
  {
    q: "Splatter vinyl vale mais para revenda?",
    a: "Em geral sim. Edições com efeito visual complexo (splatter, galaxy, marble) são produzidas em tiragens menores e têm demanda de colecionador alta. Um splatter em bom estado costuma valorizar acima do preto padrão do mesmo álbum no Discogs. O valor não vem do som, vem da raridade e do visual.",
  },
  {
    q: "Devo guardar picture disc de forma diferente?",
    a: "Os cuidados básicos são os mesmos: vertical, longe de calor e umidade. O ponto extra é a luz: o foil de polietileno é mais sensível à degradação por UV do que o PVC do vinil padrão. Mantenha longe de luz solar direta e de luz incandescente forte por períodos longos. Se for uma peça de display na parede, prefira ambientes sem incidência direta de sol.",
  },
  {
    q: "Posso limpar picture disc com água destilada normalmente?",
    a: "Sim, com cuidado redobrado nas bordas onde as camadas se encontram. Evite molhar excessivamente as extremidades do disco: a água pode penetrar entre as camadas e comprometer a laminação. Use pano de microfibra levemente úmido, movimentos circulares, seque bem antes de guardar.",
  },
];

export default function VinilColoridoPage() {
  const articleLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: PAGE_TITLE,
    description: PAGE_DESC,
    datePublished: DATE,
    dateModified: DATE_MODIFIED,
    inLanguage: "pt-BR",
    articleSection: "Guias",
    keywords: "vinil colorido, picture disc, splatter vinyl, vinil colorido qualidade, picture disc som, vinil colorido vs preto",
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
      { "@type": "ListItem", position: 3, name: "Vinil Colorido e Picture Disc Valem a Pena?", item: `${SITE_URL}/guias/${SLUG}` },
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

  const content = (
    <>
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
        <span className="text-parchment">Vinil Colorido e Picture Disc</span>
      </nav>

      {/* Hero */}
      <header className="relative mb-8 overflow-hidden rounded-2xl bg-sleeve border border-groove px-6 py-7 vinyl-grooves">
        <span className="text-xs font-semibold border rounded-full px-2.5 py-0.5 text-deallit border-deal/30 bg-deal/10 mb-4 inline-block">
          Guia
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-black text-cream leading-tight mb-3 [text-wrap:balance]">
          Vinil Colorido e Picture Disc{" "}
          <span className="text-gold">Valem a Pena?</span>
        </h1>
        <p className="text-parchment text-sm max-w-2xl leading-relaxed">
          Colorido soa pior que preto? E picture disc? Separamos mito de realidade técnica:
          o que o carbon black faz, por que o foil de polietileno é um problema real, e
          quando cada formato faz sentido comprar.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-dust">
          <span>
            Publicado em{" "}
            <time dateTime={DATE} className="text-parchment">
              1 de junho de 2026
            </time>
          </span>
          <span>
            Atualizado em{" "}
            <time dateTime={DATE_MODIFIED} className="text-parchment">
              25 de junho de 2026
            </time>
          </span>
          <span className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.25" />
              <path d="M6 3.5V6.5L7.5 8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            </svg>
            Leitura: ~13 min
          </span>
        </div>
      </header>

      {/* Hero image */}
      <figure className="mb-8 rounded-2xl overflow-hidden">
        <Image
          src="/blog/vinil-colorido-close.jpg"
          alt="Disco de vinil colorido em close, evidenciando a superfície e os sulcos de uma prensagem em cor"
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
            A edição limitada em laranja neon custa R$40 a mais do que a versão preta padrão. Você
            olha pra ela, olha pro preto e se pergunta: essa diferença de cor muda alguma coisa no
            som ou é só estética com preço premium?
          </p>
          <p>
            A resposta depende do tipo de colorido, e esse detalhe a maioria dos artigos sobre o
            tema ignora. Colorido sólido, transparente, splatter e picture disc se comportam de
            formas diferentes. Tratar os quatro como a mesma coisa leva a conclusões erradas nos
            dois sentidos: tanto &quot;colorido sempre soa pior&quot; quanto &quot;não faz nenhuma diferença&quot;.
          </p>
          <p>
            Esse guia separa cada caso com honestidade técnica.
          </p>
        </div>

        {/* 1 */}
        <section id="reputacao">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Por que o Preto tem Vantagem Histórica e o Colorido Ganhou Má Reputação
          </h2>
          <div className="space-y-4 text-parchment text-base leading-relaxed">
            <p>
              O PVC puro, matéria-prima do vinil, é naturalmente transparente com um leve tom
              amarelado. Nenhum disco é literalmente &quot;de vinil sem adição&quot;: todo disco, preto ou
              colorido, tem algum pigmento.
            </p>
            <p>
              O preto ganha o pigmento carbon black. E é aqui que a história técnica começa.
            </p>
          </div>

          <div className="mt-6">
            <h3 className="font-display text-base font-bold text-cream mb-3">
              Carbon Black: o que o Pigmento Preto Faz que os Outros Não Fazem
            </h3>
            <div className="space-y-4 text-parchment text-base leading-relaxed">
              <p>
                Carbon black não é só um corante. As partículas de carbono têm propriedades físicas
                que beneficiam o disco de formas específicas: absorvem impurezas durante o processo
                de prensagem, reduzem levemente a fricção dentro dos sulcos e têm condutividade
                elétrica suficiente para diminuir o acúmulo de carga estática na superfície.
              </p>
              <p>
                O resultado histórico foi um disco preto com superfície consistentemente mais
                silenciosa, melhor integridade estrutural e menor acúmulo de poeira em comparação
                com coloridos da mesma época.
              </p>
              <p>
                O problema dos coloridos no passado não era a cor em si. Era que os pigmentos
                disponíveis tinham propriedades de fusão diferentes do PVC base, criando
                inconsistências microscópicas durante a prensagem. Empenamento, ruído de superfície
                variável, qualidade imprevisível. Essa experiência criou a reputação que persiste
                até hoje, mesmo que a produção moderna tenha resolvido boa parte desses problemas.
              </p>
              <div className="bg-sleeve border border-groove rounded-xl p-4">
                <p className="font-semibold text-cream text-xs mb-1.5">
                  Wout Lievens, dunk!pressing (fábrica de prensagem belga):
                </p>
                <p className="text-parchment text-xs leading-relaxed">
                  &quot;Com os avanços de hoje na manufatura de vinil, essencialmente não há diferença na
                  qualidade de áudio entre vinil colorido e preto&quot;, desde que os padrões de
                  fabricação sejam altos. Fonte:{" "}
                  <a
                    href="https://www.dunkpressing.com/news/2023/3/18/colored-vinyl-vs-black-vinyl"
                    rel="nofollow noopener noreferrer"
                    target="_blank"
                    className="underline hover:text-gold transition-colors"
                  >
                    dunk!pressing, 2023
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 2 */}
        <section id="tipos">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Colorido Sólido, Transparente, Splatter e Marble: Quatro Comportamentos Diferentes
          </h2>
          <p className="text-parchment text-sm leading-relaxed mb-6 bg-sleeve border border-groove rounded-xl px-4 py-3">
            &quot;Vinil colorido&quot; não é uma categoria única. Cada formato tem um processo de produção
            diferente e, com isso, um perfil de risco sonoro diferente. Saber qual tipo você está
            comprando é mais útil do que saber se é colorido ou preto.
          </p>

          <div className="space-y-4">
            {[
              {
                label: "Colorido sólido",
                nota: "Equivalente ao preto na prática",
                notaColor: "text-dust",
                text: "Uma cor uniforme, um pigmento de boa qualidade, mesma planta e mesmo master. O dono da Vinil Brasil, Michel Nath, afirma que num teste cego com os mesmos materiais e corte ninguém consegue distinguir do preto. A diferença que existia na era dos pigmentos baratos praticamente desapareceu em prensagens modernas de qualidade.",
                source: null,
              },
              {
                label: "Transparente",
                nota: "Muito próximo do sólido",
                notaColor: "text-dust",
                text: "Usa agentes clareadores ao invés do carbon black. Visualmente bonito, sem as mesmas propriedades antiestáticas do preto, mas sonicamente muito próximo de um colorido sólido bem prensado. A desvantagem real é sensibilidade levemente maior à degradação por UV: guarde longe de luz solar direta.",
                source: null,
              },
              {
                label: "Splatter e marble",
                nota: "Risco pequeno, geralmente imperceptível",
                notaColor: "text-parchment",
                text: "Quanto mais dyes num mesmo disco, maior a variabilidade no processo. O splatter é parcialmente manual: gotas de PVC colorido são aplicadas sobre a base antes da prensagem. Isso introduz pequenas irregularidades potenciais nas paredes dos sulcos se o controle de qualidade da planta não for rigoroso. Em plantas boas, o impacto é negligenciável. Em plantas de segundo escalão, pode aparecer como variação de ruído ou levíssima distorção.",
                source: null,
              },
              {
                label: "Pigmentos metálicos (ouro e prata)",
                nota: "A exceção onde a diferença é real",
                notaColor: "text-gold",
                text: "Aqui a distinção não é mito. Pigmentos metálicos têm propriedades térmicas diferentes do PVC base e podem causar ruído adicional de superfície, especialmente em passagens com muito baixo. A própria dunk!pressing documenta isso. Se você vai escolher entre uma edição dourada e uma preta e o objetivo principal é som, a preta ganha.",
                source: "https://www.dunkpressing.com/news/2023/3/18/colored-vinyl-vs-black-vinyl",
                sourceLabel: "dunk!pressing",
              },
            ].map(({ label, nota, notaColor, text, source, sourceLabel }) => (
              <div key={label} className="bg-sleeve border border-groove rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-display text-base font-bold text-cream">{label}</p>
                  <span className={`text-xs font-medium ${notaColor}`}>{nota}</span>
                </div>
                <p className="text-parchment text-sm leading-relaxed">{text}</p>
                {source && (
                  <p className="text-dust text-xs mt-2">
                    Fonte:{" "}
                    <a
                      href={source}
                      rel="nofollow noopener noreferrer"
                      target="_blank"
                      className="underline hover:text-gold transition-colors"
                    >
                      {sourceLabel}
                    </a>
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8">
            <h3 className="font-display text-base font-bold text-cream mb-3">
              Todos os Tipos Lado a Lado
            </h3>
            <p className="text-parchment text-sm leading-relaxed mb-4">
              O que esperar de cada formato em som e em valor de coleção. &quot;Risco pequeno&quot; quer
              dizer que uma planta séria controla bem; numa planta de segundo escalão, qualquer um
              deles pode variar.
            </p>
            <div className="overflow-x-auto rounded-xl border border-groove">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-groove bg-sleeve">
                    <th className="py-3 px-4 text-left text-[10px] font-semibold text-dust uppercase tracking-wider">Tipo</th>
                    <th className="py-3 px-4 text-left text-[10px] font-semibold text-dust uppercase tracking-wider">Som</th>
                    <th className="py-3 px-4 text-left text-[10px] font-semibold text-dust uppercase tracking-wider">Coleção</th>
                    <th className="py-3 px-4 text-left text-[10px] font-semibold text-dust uppercase tracking-wider">O que pesa</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { tipo: "Preto", som: "Referência", colecao: "Padrão", nota: "Carbon black: superfície mais silenciosa e PVC mais resistente" },
                    { tipo: "Colorido sólido", som: "Igual ao preto", colecao: "Médio", nota: "Em planta boa, indistinguível num teste cego" },
                    { tipo: "Transparente / clear", som: "Quase igual", colecao: "Médio", nota: "Sem a antiestática do preto; mais sensível a UV" },
                    { tipo: "Splatter / marble", som: "Risco pequeno", colecao: "Alto", nota: "Aplicação em parte manual; depende do controle da planta" },
                    { tipo: "Galaxy / nebuloso", som: "Risco pequeno", colecao: "Alto", nota: "Mesma lógica do splatter: mais cor, mais variável" },
                    { tipo: "Neon / UV-reativo", som: "Quase igual", colecao: "Alto", nota: "Pigmento fluorescente; o visual chama mais que o som incomoda" },
                    { tipo: "Glow in the dark", som: "Risco pequeno a médio", colecao: "Alto", nota: "Pigmento fosforescente adiciona partícula ao PVC e pode subir o ruído de fundo" },
                    { tipo: "Branco", som: "Quase igual", colecao: "Médio", nota: "Pigmento opaco; bom em planta boa" },
                    { tipo: "Metálico (ouro, prata)", som: "Pior documentado", colecao: "Alto", nota: "Partícula metálica eleva o ruído, principalmente no grave" },
                    { tipo: "Picture disc", som: "Pior", colecao: "Alto (display)", nota: "Sulco em foil de polietileno: mais ruído e degradação mais rápida" },
                  ].map(({ tipo, som, colecao, nota }) => (
                    <tr key={tipo} className="border-b border-groove/40 last:border-0 hover:bg-sleeve/60 transition-colors">
                      <td className="py-2.5 px-4 text-cream text-xs font-medium">{tipo}</td>
                      <td className="py-2.5 px-4 text-parchment text-xs">{som}</td>
                      <td className="py-2.5 px-4 text-parchment text-xs">{colecao}</td>
                      <td className="py-2.5 px-4 text-dust text-xs leading-relaxed">{nota}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 3 */}
        <section id="picture-disc">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            O Caso Separado do Picture Disc
          </h2>
          <p className="text-parchment text-sm leading-relaxed mb-5 bg-sleeve border border-groove rounded-xl px-4 py-3">
            Picture disc não é vinil colorido. É uma categoria diferente com uma estrutura física
            diferente, e os problemas de qualidade sonora que ele tem não têm nada a ver com
            pigmento. São estruturais.
          </p>

          <div className="space-y-6">
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Como um Picture Disc é Fabricado na Prática
              </h3>
              <div className="space-y-4 text-parchment text-base leading-relaxed">
                <p>
                  Um picture disc começa como uma base de PVC padrão. Sobre ela, de cada lado, é
                  aplicada uma folha impressa com a arte. Por cima dessa arte, em ambos os lados, vai
                  uma camada fina de foil de polietileno transparente. Esse sanduíche é prensado
                  junto com calor e pressão.
                </p>
                <p>
                  Os sulcos são cortados no foil de polietileno, não no PVC sólido da base. Esse
                  detalhe de fabricação é responsável por todos os problemas sonoros que o picture
                  disc tem. Não é mito, não é exagero de audiófilo: é física do material.
                </p>
                <p className="text-xs text-dust">
                  Processo detalhado documentado pela{" "}
                  <a
                    href="https://atlasrecords.co.uk/blogs/all-about-vinyl/how-are-vinyl-picture-discs-made-and-why-dont-they-sound-as-good-as-a-regular-record"
                    rel="nofollow noopener noreferrer"
                    target="_blank"
                    className="underline hover:text-gold transition-colors"
                  >
                    Atlas Records
                  </a>
                  , fábrica de prensagem britânica.
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                O Problema Real: Polietileno, Microbolsas e Degradação com o Uso
              </h3>
              <figure className="mb-4 rounded-xl overflow-hidden">
                <Image
                  src="/blog/vinil-colorido-superficie.jpg"
                  alt="Disco de vinil colorido sobre superfície, mostrando a transparência e os sulcos da prensagem colorida"
                  width={800}
                  height={450}
                  className="w-full object-cover max-h-72"
                />
                <figcaption className="text-xs text-dust mt-2 px-1">
                  Num picture disc, a agulha lê sulcos cortados em foil de polietileno, não em PVC sólido. A diferença de material tem consequências diretas na qualidade de reprodução.
                </figcaption>
              </figure>
              <div className="space-y-4 text-parchment text-base leading-relaxed">
                <p>
                  Polietileno degrada mais rápido que PVC. Cada reprodução é ligeiramente mais
                  destrutiva para a superfície de um picture disc do que para um disco preto
                  equivalente. Com o tempo, a diferença se acumula.
                </p>
                <p>
                  O segundo problema são as microbolsas. A laminação entre as camadas nunca é
                  perfeita em 100% da superfície. Onde há imperfeições mínimas na união entre o
                  foil e a arte impressa, formam-se bolsas de ar microscópicas. A agulha passa sobre
                  elas e o resultado é o clique ou o crackle que você ouve e que não existe no
                  arquivo original.
                </p>
                <p>
                  A isso some-se ruído de fundo sistematicamente mais alto do que vinil sólido,
                  resposta de graves um pouco reduzida e mais acúmulo de carga estática pela
                  estrutura em camadas. Os picture discs modernos melhoraram com melhor laminação e
                  corte mais preciso dos sulcos, mas a lacuna persiste. Num sistema de entrada, você
                  pode não notar. Num sistema mais resolvido, você vai.
                </p>
                <div className="bg-sleeve border border-groove rounded-xl p-4">
                  <p className="font-semibold text-cream text-xs mb-1.5">Resumo técnico:</p>
                  <div className="grid sm:grid-cols-2 gap-3 text-xs text-parchment">
                    {[
                      { label: "Sulcos em", value: "Foil de polietileno (não em PVC)" },
                      { label: "Degradação", value: "Mais rápida que vinil padrão" },
                      { label: "Microbolsas", value: "Causam pops e crackles estruturais" },
                      { label: "Ruído de fundo", value: "Sistematicamente mais alto" },
                      { label: "Graves", value: "Levemente reduzidos" },
                      { label: "Estática", value: "Maior acúmulo pelas camadas" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex gap-2">
                        <span className="text-dust shrink-0">{label}:</span>
                        <span>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4 */}
        <section id="quando-colorido">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Quando Comprar Colorido Faz Sentido
          </h2>
          <div className="space-y-4 text-parchment text-base leading-relaxed">
            <p>
              Colorido sólido de boa qualidade entrega o mesmo som que o preto equivalente. Isso
              significa que a escolha entre um e outro é, na prática, estética. O único critério
              adicional que importa é verificar se ambas as versões vieram do mesmo master e da
              mesma planta. Pra saber como checar masterização e planta antes de comprar, veja o
              nosso{" "}
              <Link href="/guias/vinil-180g-vale-a-pena" className="underline hover:text-gold transition-colors">
                guia sobre vinil 180g e qualidade de prensagem
              </Link>
              .
            </p>
            <p>
              Onde o colorido agrega valor concreto é como peça de coleção. Edições limitadas em
              cores específicas ou efeitos visuais complexos tendem a valorizar acima da versão
              preta no Discogs com o tempo, especialmente em álbuns de artistas com comunidade de
              colecionadores ativa. Se você compra pensando em revenda futura, colorido limitado
              costuma ser melhor aposta do que o preto padrão.
            </p>
          </div>
          <div className="mt-5 grid sm:grid-cols-2 gap-4">
            {[
              {
                label: "Faz sentido",
                color: "text-dust",
                items: [
                  "Edição limitada com mesmo master e planta da versão preta",
                  "Você quer a peça como objeto visual além do disco para ouvir",
                  "O preço premium é pequeno em relação ao valor total do disco",
                  "Você coleciona para revenda e a edição colorida tem tiragem pequena",
                  "É splatter ou marble de planta conhecida e bem avaliada no Discogs",
                ],
              },
              {
                label: "Pense duas vezes",
                color: "text-parchment",
                items: [
                  "É a única cópia disponível e seu sistema de alta fidelidade é exigente",
                  "O premium de preço é alto e a planta de prensagem não foi informada",
                  "É pigmento metálico (ouro, prata) e qualidade sonora é prioridade",
                  "É splatter de planta desconhecida com pouco feedback no Discogs",
                  "Você precisa de uma cópia confiável para uso intenso",
                ],
              },
            ].map(({ label, color, items }) => (
              <div key={label} className="bg-sleeve border border-groove rounded-xl p-4">
                <p className={`font-semibold text-xs mb-3 ${color}`}>{label}</p>
                <ul className="space-y-1.5">
                  {items.map((item, i) => (
                    <li key={i} className="text-xs text-parchment leading-relaxed flex gap-2">
                      <span className="text-gold mt-0.5 shrink-0">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* 5 */}
        <section id="quando-picture-disc">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Quando Picture Disc Faz Sentido e Quando Não Faz
          </h2>
          <figure className="mb-6 rounded-xl overflow-hidden">
            <Image
              src="/blog/colecao-vinil-colorido.jpg"
              alt="Coleção de discos de vinil coloridos empilhados, evidenciando a diversidade de cores e formatos de edições limitadas"
              width={800}
              height={533}
              className="w-full object-cover max-h-64"
            />
            <figcaption className="text-xs text-dust mt-2 px-1">
              Picture disc como peça de display: o uso mais honesto para o formato.
            </figcaption>
          </figure>
          <div className="space-y-4 text-parchment text-base leading-relaxed">
            <p>
              A regra mais direta que existe para picture disc: compre para exibir, ouça a versão
              preta. Não é ceticismo barato. É reconhecer para que o formato foi projetado e para
              que ele serve bem.
            </p>
            <p>
              Picture discs nasceram como peça promocional e de display. Os primeiros apareceram
              nos anos 30, voltaram com força nos anos 70 como edições limitadas de artistas como
              Beatles e Pink Floyd, e hoje vivem como exclusivas de Record Store Day e edições de
              colecionador. Em nenhum desses contextos o objetivo principal foi a qualidade sonora.
            </p>
            <p>
              Isso não significa que você não deva comprar. Significa que você deve comprar sabendo
              o que está levando.
            </p>
          </div>
          <div className="mt-5 grid sm:grid-cols-2 gap-4">
            {[
              {
                label: "Picture disc faz sentido quando",
                color: "text-dust",
                items: [
                  "Você quer pendurar na parede ou exibir na estante como objeto visual",
                  "É uma edição de colecionador de artista que você acompanha e não vai revender",
                  "Você já tem a versão preta para ouvir e quer a visual para completar a coleção",
                  "É uma exclusiva de Record Store Day que não existe em nenhum outro formato",
                  "Seu sistema é de entrada e a diferença sonora não vai ser perceptível para você",
                ],
              },
              {
                label: "Picture disc não faz sentido quando",
                color: "text-red-400",
                items: [
                  "É sua única cópia do álbum e você vai ouvir regularmente",
                  "Seu sistema de reprodução é mais resolvido e vai expor as limitações",
                  "Você está pagando preço premium esperando qualidade sonora premium",
                  "Você não tem onde exibir e ele vai ficar guardado numa estante tocando toda semana",
                  "Existe versão preta disponível ao mesmo preço ou levemente mais caro",
                ],
              },
            ].map(({ label, color, items }) => (
              <div key={label} className="bg-sleeve border border-groove rounded-xl p-4">
                <p className={`font-semibold text-xs mb-3 ${color}`}>{label}</p>
                <ul className="space-y-1.5">
                  {items.map((item, i) => (
                    <li key={i} className="text-xs text-parchment leading-relaxed flex gap-2">
                      <span className="text-gold mt-0.5 shrink-0">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-parchment text-sm leading-relaxed mt-5">
            Para quem tem curiosidade sobre a evolução histórica do picture disc e os avanços
            técnicos recentes em laminação,{" "}
            <a
              href="https://mostlymusicstore.co.uk/blogs/news/picture-discs-do-they-really-sound-worse-myth-history-and-modern-reality"
              rel="nofollow noopener noreferrer"
              target="_blank"
              className="underline hover:text-gold transition-colors"
            >
              esse artigo da Mostly Music Store
            </a>
            {" "}cobre bem o contexto desde os anos 30 até o presente.
          </p>
        </section>

        {/* 6 — FAQ */}
        <section id="faq">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Perguntas Frequentes Sobre Vinil Colorido e Picture Disc
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
              A Cor É Estética. A Estrutura Não É.
            </h2>
            <div className="space-y-3 text-parchment text-base leading-relaxed">
              <p>
                Colorido sólido moderno de boa planta soa como o preto equivalente. Splatter e
                marble adicionam um risco mínimo que plantas sérias controlam bem. Pigmento metálico
                é a única cor que ainda traz desvantagem sonora documentada.
              </p>
              <p>
                Picture disc é uma categoria diferente. Os problemas não são de pigmento: são do
                foil de polietileno onde os sulcos vivem, das microbolsas entre as camadas e da
                degradação mais rápida com o uso. Isso não mudou fundamentalmente com os avanços de
                fabricação.
              </p>
              <p>
                A decisão prática é simples. Para ouvir: versão preta ou colorido sólido de boa
                planta. Para exibir e colecionar: picture disc e splatter têm valor visual e de
                colecionador que o preto padrão não tem. Os dois papéis coexistem bem desde que você
                não confunda um com o outro.
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
              { href: "/guias/vinil-180g-vale-a-pena", title: "Vinil 180g Vale a Pena?", desc: "O que é diferença real e o que é marketing na gramatura do disco." },
              { href: "/guias/como-cuidar-de-discos-de-vinil", title: "Como Cuidar de Discos de Vinil", desc: "Limpeza, armazenamento e os cuidados extras que picture disc exige." },
            ].map(({ href, title, desc }) => (
              <Link key={href} href={href} className="block bg-sleeve border border-groove rounded-xl p-4 hover:border-patina transition-colors">
                <p className="font-display text-sm font-bold text-cream mb-1">{title}</p>
                <p className="text-parchment text-xs leading-relaxed">{desc}</p>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </>
  );

  return (
    <div className="vinil-sidebar-layout mx-auto px-4 py-8">
      {content}
    </div>
  );
}
