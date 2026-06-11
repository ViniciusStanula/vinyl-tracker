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
const SLUG = "vinil-180g-vale-a-pena";
const PAGE_TITLE = "Vinil 180g Vale a Pena? Diferença Real ou Marketing?";
const PAGE_DESC =
  "O peso do disco influencia o som? Separamos diferença real (durabilidade, VTA, superfície) de marketing puro, com foco no comprador brasileiro.";
const DATE = "2026-05-31";
const DATE_MODIFIED = "2026-06-09";
const HERO_IMAGE = `${SITE_URL}/blog/agulha-toca-discos-vinil.jpg`;

export const metadata: Metadata = {
  title: "Vinil 180g Vale a Pena ou É Só Marketing? | Garimpa Vinil",
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
        height: 675,
        alt: "Cápsula e agulha de toca-discos em close sobre disco de vinil girando no prato",
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
  { id: "o-que-significa", label: "O que o número realmente significa" },
  { id: "o-que-nao-faz", label: "O que o peso não faz" },
  { id: "o-que-faz", label: "O que o peso faz de verdade" },
  { id: "vta", label: "O detalhe que quase ninguém menciona: o VTA" },
  { id: "original-vs-reissue", label: "Prensagem original ou reissue 180g: qual vale mais?" },
  { id: "para-quem-faz-sentido", label: "Para quem o 180g faz sentido" },
  { id: "como-identificar", label: "Como identificar um 180g feito com cuidado" },
  { id: "faq", label: "Perguntas frequentes" },
];

const FAQ = [
  {
    q: "Disco 180g soa melhor do que disco de 120g?",
    a: "Não necessariamente. A qualidade sonora depende principalmente da masterização, da composição do PVC e do cuidado na prensagem, não do peso. Um disco de 120g bem masterizado e bem prensado vai soar melhor do que um 180g feito com masterização ruim ou PVC de baixa qualidade. O que o 180g oferece de concreto é maior resistência ao empenamento e melhor estabilidade mecânica, especialmente em toca-discos de entrada.",
  },
  {
    q: "Preciso ajustar o toca-discos para tocar disco 180g?",
    a: "Se o seu toca-discos tem ajuste de VTA (Vertical Tracking Angle) no braço, sim, um ajuste fino pode fazer diferença: disco mais grosso senta mais alto no prato e cria viés negativo de VTA, o que afeta o equilíbrio de graves e agudos. Se o braço não tem ajuste de VTA (caso da maioria dos toca-discos de entrada e médio porte), um tapete de espessura levemente menor ajuda a compensar. O ajuste do peso de rastreio não precisa ser alterado para 180g.",
  },
  {
    q: "Vinil colorido e picture disc são 180g de qualidade?",
    a: "Não. Vinil colorido usa pigmentos que podem introduzir impurezas no PVC, e picture disc usa camadas de papel laminadas no vinil, o que impacta negativamente a qualidade da superfície e a leitura da agulha. Independentemente do peso, esses formatos priorizam estética e nunca são a melhor opção sonora. São colecionáveis, não produtos audiófilos.",
  },
  {
    q: "Como saber se um reissue 180g foi bem masterizado?",
    a: "Pesquise no encarte ou na página do disco no Discogs: os campos \"Mastered By\" e \"Notes\" costumam indicar o engenheiro e a fonte. Nomes como Kevin Gray, Ryan K. Smith, Bernie Grundman, Chris Bellman e Miles Showell têm reputação estabelecida na comunidade. A nota \"mastered from original analog tapes\" vale mais do que qualquer informação de gramatura. Labels que não informam a fonte da masterização são um sinal de alerta.",
  },
  {
    q: "Qual é o peso padrão de um disco de vinil novo hoje?",
    a: "A maioria dos lançamentos de mercado de massa sai em 140g. Discos de linha mais barata vêm em 120g. O 180g é reservado para edições que querem se posicionar como premium, com ou sem investimento real em qualidade. Discos de 200g e 220g existem principalmente em edições audiófilas americanas, mas não são o padrão.",
  },
  {
    q: "Vale a pena pagar mais por vinil 180g no Brasil?",
    a: "Depende do que está por trás do 180g. Se o reissue foi feito a partir de fitas originais, prensado em planta certificada e com engenheiro de masterização renomado, provavelmente sim. Se o único diferencial é o peso, com masterização digital genérica e planta desconhecida, não. Pesquise antes de comprar. Um original bem preservado de sebo frequentemente entrega mais por menos.",
  },
];

export default function Vinil180gPage() {
  const articleLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: PAGE_TITLE,
    description: PAGE_DESC,
    datePublished: DATE,
    dateModified: DATE_MODIFIED,
    inLanguage: "pt-BR",
    articleSection: "Guias",
    keywords: "vinil 180g, vinil 180 gramas, disco pesado, prensagem vinil, gramatura vinil, vale a pena 180g",
    author: { "@type": "Organization", name: "Garimpa Vinil", url: `${SITE_URL}/sobre` },
    publisher: { "@type": "Organization", name: "Garimpa Vinil", url: SITE_URL },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/guias/${SLUG}` },
    image: {
      "@type": "ImageObject",
      url: HERO_IMAGE,
      width: 1200,
      height: 675,
    },
    speakable: { "@type": "SpeakableSpecification", cssSelector: ["h1"] },
  });

  const breadcrumbLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Guias", item: `${SITE_URL}/guias` },
      { "@type": "ListItem", position: 3, name: "Vinil 180g Vale a Pena?", item: `${SITE_URL}/guias/${SLUG}` },
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
        <span className="text-parchment">Vinil 180g Vale a Pena?</span>
      </nav>

      {/* Hero */}
      <header className="relative mb-8 overflow-hidden rounded-2xl bg-sleeve border border-groove px-6 py-7 vinyl-grooves">
        <span className="text-xs font-semibold border rounded-full px-2.5 py-0.5 text-deallit border-deal/30 bg-deal/10 mb-4 inline-block">
          Guia
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-black text-cream leading-tight mb-3 [text-wrap:balance]">
          Vinil 180g Vale a Pena?{" "}
          <span className="text-gold">Diferença Real ou Marketing?</span>
        </h1>
        <p className="text-parchment text-sm max-w-2xl leading-relaxed">
          O peso do disco influencia o som? Separamos o que é diferença real (durabilidade, VTA,
          superfície) de marketing puro, com a perspectiva de quem compra vinil no Brasil.
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
            Leitura: ~12 min
          </span>
        </div>
      </header>

      {/* Hero image */}
      <figure className="mb-8 rounded-2xl overflow-hidden">
        <Image
          src="/blog/agulha-toca-discos-vinil.jpg"
          alt="Cápsula e agulha de toca-discos em close, posicionada sobre disco de vinil girando no prato"
          width={1200}
          height={675}
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
              <a
                href={`#${item.id}`}
                className="text-sm text-parchment hover:text-gold transition-colors"
              >
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
            Você abre o encarte, vê o selo &quot;180 Gramas&quot; em destaque e o preço sobe trinta, quarenta
            reais em relação à edição padrão. Fica a dúvida: esse peso extra faz diferença de verdade
            no som ou é só um argumento de venda bem embrulhado?
          </p>
          <p>
            A resposta honesta é que depende, e esse &quot;depende&quot; tem partes técnicas específicas que a
            maioria dos artigos sobre o tema simplifica demais ou ignora. Tem coisa que o 180g faz
            melhor de verdade. Tem coisa que ele não faz, por mais que o marketing diga o contrário.
            E tem um aspecto que quase ninguém menciona, que é o VTA, e que pode fazer um disco 180g
            soar pior do que um 120g no mesmo equipamento.
          </p>
          <p>
            Esse guia cobre tudo isso sem hype e sem ceticismo barato.
          </p>
        </div>

        {/* 1 */}
        <section id="o-que-significa">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            O que o Número Realmente Significa (e o que ele Não Diz)
          </h2>
          <div className="space-y-4 text-parchment text-base leading-relaxed">
            <p>
              A gramatura de um disco de vinil é simplesmente o peso do disco em gramas. Não é uma
              medida de qualidade sonora, não é um padrão de masterização, não diz nada sobre o
              processo de prensagem ou sobre a fábrica que produziu o disco. É literalmente o peso
              do plástico.
            </p>
            <p>
              O padrão hoje funciona mais ou menos assim: 120g é o piso para discos mais baratos e
              de mercado de massa; 140g é o padrão da maior parte dos lançamentos novos; 180g é o
              patamar &quot;premium&quot; adotado por gravadoras e reissue labels que querem sinalizar
              qualidade; 200g e 220g aparecem em edições audiófilas americanas específicas.
            </p>
          </div>

          <div className="mt-6">
            <h3 className="font-display text-base font-bold text-cream mb-3">
              Do 90g dos Anos 70 ao 180g de Hoje: Como o Peso Mudou
            </h3>
            <div className="space-y-4 text-parchment text-base leading-relaxed">
              <p>
                Existe uma ideia circulando que diz que &quot;os discos antigos eram mais pesados&quot;. Não é
                exatamente assim. Nos anos 50 e 60, os LPs saíam com peso variado, muitas vezes entre
                150 e 180 gramas, mas sem o objetivo de sinalizar qualidade premium. Era só o quanto
                de PVC se usava na época.
              </p>
              <p>
                A crise do petróleo de 1973 mudou isso. PVC é derivado de petróleo e o preço subiu.
                As gravadoras americanas começaram a reduzir a quantidade de material por disco. A
                Columbia chegou a lançar a linha Dynaflex no fim dos anos 60 e ao longo dos 70, com
                discos que chegavam a 90 gramas, finos e flexíveis a ponto de dobrar. Eram ruins de
                manusear e propensos a empenar. Esse período manchou a reputação do disco leve por
                décadas.
              </p>
              <p>
                O 180g como sinal de premium surgiu no começo dos anos 2000, com labels de reissue
                audiófilo como Analogue Productions, Music Matters e Speakers Corner, que prensavam
                em 180g e 200g e investiam de verdade em masterização de qualidade. O problema é que
                o mercado viu o sucesso desse posicionamento e adotou o peso como atalho de marketing,
                sem necessariamente manter o investimento em qualidade por trás.
              </p>
            </div>
          </div>
        </section>

        {/* 2 */}
        <section id="o-que-nao-faz">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            O que o Peso Não Faz, Apesar do que Dizem
          </h2>
          <p className="text-parchment text-sm leading-relaxed mb-5 bg-sleeve border border-groove rounded-xl px-4 py-3">
            O sulco de um disco de vinil segue o mesmo padrão técnico de corte independentemente do
            peso. A agulha não sente se o disco tem 120g ou 180g: ela lê apenas a geometria
            microscópica gravada no sulco. O peso não determina a profundidade nem a largura dos
            sulcos.
          </p>

          <div className="space-y-6">
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Por que a Masterização Manda Mais do que a Gramatura
              </h3>
              <div className="space-y-4 text-parchment text-base leading-relaxed">
                <p>
                  O som de um disco de vinil é decidido antes de qualquer coisa pelo engenheiro de
                  masterização. É ele quem recebe o arquivo de áudio, ajusta a dinâmica e o equilíbrio
                  de frequências para o formato físico do vinil e corta a lacca que vai ser usada como
                  molde para a prensagem. A gramatura do disco final não muda nada disso.
                </p>
                <p>
                  Jon Jeary, da Goldring, fabricante britânico de cápsulas com décadas de história no
                  mercado, foi direto quando consultado pela{" "}
                  <a
                    href="https://www.whathifi.com/hi-fi/vinyl/is-180g-vinyl-worth-it-we-asked-several-hi-fi-manufacturers-if-a-records-weight-can-impact-sound-quality"
                    rel="nofollow noopener noreferrer"
                    target="_blank"
                    className="underline hover:text-gold transition-colors"
                  >
                    What Hi-Fi
                  </a>
                  : &quot;Não há nada que o peso do vinil contribua ao som.&quot; O disco que Jeary considera
                  sonicamente o melhor da sua coleção é um half-speed master em 120 gramas. Não um
                  audiófilo de 200g. Um 120g bem trabalhado.
                </p>
                <p>
                  Half-speed mastering é uma técnica em que o torno de corte da lacca roda à metade
                  da velocidade normal. O engenheiro consegue capturar mais detalhe nas altas
                  frequências e reduzir distorção. O resultado é um disco com mais definição e melhor
                  separação de instrumentos. Não tem nada a ver com gramatura.
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                O 180g com Masterização Ruim: Marketing em Disco Pesado
              </h3>
              <div className="space-y-4 text-parchment text-base leading-relaxed">
                <p>
                  Esse é o caso que mais frustra quem compra com a expectativa errada. Existe um número
                  crescente de reissues em 180g que usam como fonte um arquivo digital de qualidade
                  média, às vezes derivado de um CD ou de uma transferência digital comprimida, e que
                  saem com o peso e o preço de um produto premium sem o investimento sonoro que
                  justificaria isso.
                </p>
                <p>
                  O problema não é o 180g em si. É que o consumidor pagou pelo peso e achou que estava
                  pagando pela qualidade. O resultado prático é um disco que pesa mais do que uma
                  prensagem original dos anos 70, custa mais e soa pior, porque a fonte digital era
                  inferior ao que a fita analógica original entregaria.
                </p>
                <div className="bg-sleeve border border-groove rounded-xl p-4">
                  <p className="font-semibold text-cream text-xs mb-1.5">Lothar Mertens, DUAL GmbH:</p>
                  <p className="text-parchment text-xs leading-relaxed">
                    &quot;O peso de um disco de vinil não afeta diretamente a qualidade do som quando os
                    discos usam o mesmo master e o mesmo cuidado de produção.&quot;
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3 */}
        <section id="o-que-faz">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            O que o Peso Faz de Verdade
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Resistência ao Empenamento: Onde o 180g Ganha de Verdade
              </h3>
              <div className="space-y-4 text-parchment text-base leading-relaxed">
                <p>
                  Esse é o benefício mais concreto e verificável do disco mais pesado. Mais massa
                  significa mais resistência à deformação causada por calor, pressão e variações de
                  temperatura. Testes comparativos de prensagens indicam taxa de empenamento cerca de
                  40% menor em discos de 180g sob as mesmas condições de armazenamento.
                </p>
                <p>
                  No contexto brasileiro, isso tem peso extra, com perdão do trocadilho. O clima quente
                  de boa parte do país, com temperatura que amolece o PVC e variações bruscas ao longo
                  do ano, torna a resistência ao empenamento um argumento real, não abstrato. Um 180g
                  guardado inadequadamente ainda pode empenar. Mas vai resistir mais do que um 120g
                  nas mesmas condições ruins.
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Estabilidade Mecânica e Ruído de Fundo
              </h3>
              <figure className="mb-4 rounded-xl overflow-hidden">
                <Image
                  src="/blog/agulha-toca-discos-vinil.jpg"
                  alt="Cápsula e agulha de toca-discos em close, posicionada sobre a superfície de um disco de vinil girando"
                  width={800}
                  height={450}
                  className="w-full object-cover max-h-72"
                />
                <figcaption className="text-xs text-dust mt-2 px-1">
                  Maior massa no prato significa menos vibração transmitida da base do toca-discos para a agulha durante a reprodução.
                </figcaption>
              </figure>
              <div className="space-y-4 text-parchment text-base leading-relaxed">
                <p>
                  Um disco mais pesado tem mais inércia. No prato do toca-discos, isso significa que
                  vibrações externas e do próprio motor encontram mais resistência para interferir na
                  leitura da agulha. Leif Johannsen, da Ortofon, resume bem: disco mais pesado oferece
                  mais &quot;ancoragem&quot; para o stylus.
                </p>
                <p>
                  Edward Forth, da Audio-Technica Europa, vai na mesma direção: maior massa reduz a
                  transferência de vibração do motor do toca-discos. Robert Suchy, da Clearaudio,
                  completa dizendo que o resultado prático são menos ressonâncias durante a reprodução.
                </p>
                <p>
                  O ponto de atenção, levantado pelo próprio Johannsen, é que toca-discos de entrada
                  se beneficiam mais dessa característica do que equipamentos de alto padrão. Um
                  toca-discos de alta fidelidade já tem controle de vibração próprio. Num Audio-Technica
                  LP120, a diferença do 180g vai ser mais perceptível do que num Rega Planar 3. Isso não
                  invalida o benefício, mas ajuda a calibrar a expectativa.
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                PVC Virgem ou Reciclado: o que Importa Mais do que o Peso
              </h3>
              <div className="space-y-4 text-parchment text-base leading-relaxed">
                <p>
                  Aqui está uma variável que influencia o som mais diretamente do que a gramatura e
                  que fica escondida por baixo do debate sobre peso: a composição do PVC.
                </p>
                <p>
                  PVC virgem é a formulação pura, sem conteúdo reciclado. Superfícies mais quietas,
                  menos ruído de fundo, menos partículas estranhas nos sulcos. Prensagens audiófilas
                  de alta qualidade usam PVC virgem como padrão. PVC com conteúdo reciclado é mais
                  barato, mas introduz impurezas que se traduzem em crepitação e noise floor mais alto.
                </p>
                <p>
                  Muitos reissues em 180g usam PVC virgem. Mas isso é uma decisão de qualidade
                  independente do peso. Existe 180g com PVC reciclado e existe 140g com PVC virgem.
                  O que você ouve como &quot;superfície mais silenciosa&quot; num 180g de qualidade
                  provavelmente tem mais a ver com o PVC virgem do que com os gramas a mais.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4 */}
        <section id="vta">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            O Detalhe que Quase Ninguém Menciona: o VTA
          </h2>
          <p className="text-parchment text-sm leading-relaxed mb-5 bg-sleeve border border-groove rounded-xl px-4 py-3">
            VTA é o Vertical Tracking Angle: o ângulo que a agulha forma com a superfície do disco
            durante a reprodução. Quando o disco é mais grosso, ele senta mais alto no prato, e isso
            muda o ângulo do braço em relação à superfície. Um VTA errado afeta diretamente o
            equilíbrio de graves e agudos.
          </p>
          <div>
            <h3 className="font-display text-base font-bold text-cream mb-3">
              Como Disco Mais Grosso Pode Soar Pior se o Braço Não Estiver Ajustado
            </h3>
            <div className="space-y-4 text-parchment text-base leading-relaxed">
              <p>
                O VTA ideal é aquele em que o braço fica paralelo ao prato com o disco rodando. Quando
                você coloca um disco de 180g num prato calibrado para 140g, o disco senta mais alto e
                a traseira do braço fica ligeiramente elevada. Isso cria o que se chama de VTA negativo:
                a ponta da agulha está inclinada para trás em relação ao ângulo correto.
              </p>
              <p>
                O resultado auditivo não é sutil. VTA negativo tende a deixar os graves mais inflados
                e os agudos menos definidos. Em toca-discos com braço de VTA ajustável, a correção é
                simples: levantar ligeiramente a base do braço para compensar a espessura maior. Mas a
                maioria dos toca-discos de entrada e de médio porte tem braço fixo, sem ajuste de VTA.
              </p>
              <p>
                A solução prática para quem não tem VTA ajustável é usar um tapete de espessura
                levemente menor com os discos de 180g. Não resolve com precisão, mas compensa parte
                do desalinhamento. A outra verificação possível é olhar se o braço está visualmente
                paralelo ao prato quando o disco estiver rodando.
              </p>
              <p>
                O ponto importante: se você tem um toca-discos de braço fixo e não faz esse ajuste,
                pode estar ouvindo o 180g em condição sub-ótima. O mesmo 120g, que é o peso de
                referência para calibração de fábrica na maioria dos equipamentos, pode estar
                entregando VTA melhor calibrado no mesmo aparelho.
              </p>
              <div className="bg-sleeve border border-groove rounded-xl p-4">
                <p className="font-semibold text-cream text-xs mb-1.5">Referência técnica:</p>
                <p className="text-parchment text-xs leading-relaxed">
                  A relação entre espessura do disco e VTA é documentada por fabricantes de braços como{" "}
                  <a
                    href="https://stackaudio.co.uk/how-to-adjust-your-vta-and-why-its-important/"
                    rel="nofollow noopener noreferrer"
                    target="_blank"
                    className="underline hover:text-gold transition-colors"
                  >
                    Stack Audio
                  </a>
                  {" "}e discutida em fóruns especializados como o{" "}
                  <a
                    href="https://www.vinylengine.com/turntable_forum/viewtopic.php?f=18&t=85290"
                    rel="nofollow noopener noreferrer"
                    target="_blank"
                    className="underline hover:text-gold transition-colors"
                  >
                    Vinyl Engine
                  </a>
                  . Prensagens de 180g criam viés de VTA negativo em braços calibrados para espessura padrão.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5 */}
        <section id="original-vs-reissue">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Prensagem Original dos Anos 70 ou Reissue 180g Atual: Qual Vale Mais?
          </h2>
          <figure className="mb-6 rounded-xl overflow-hidden">
            <Image
              src="/blog/capas-discos-vinil-sebo.jpg"
              alt="Bancadas de discos de vinil em feira, com diversas capas visíveis em ordem vertical"
              width={800}
              height={533}
              className="w-full object-cover max-h-72"
            />
            <figcaption className="text-xs text-dust mt-2 px-1">
              A questão central na hora de comprar não é 120g ou 180g: é qual foi a fonte usada para a masterização.
            </figcaption>
          </figure>
          <div className="space-y-4 text-parchment text-base leading-relaxed">
            <p>
              Essa é a pergunta que mais divide audiófilos, e a resposta muda disco a disco. Não
              existe resposta universal.
            </p>
            <p>
              A vantagem da prensagem original é a fonte. Discos feitos na época do lançamento foram
              cortados direto das fitas analógicas master, sem conversão digital, sem transferência
              de geração em geração. Para muitos álbuns de rock e jazz dos anos 60 e 70, a prensagem
              original ainda representa o teto sonicamente possível, mesmo sendo mais leve.
            </p>
            <p>
              O problema está na palavra &quot;conservado&quot;. Um original em{" "}
              <Link href="/guias/como-avaliar-estado-disco-vinil" className="underline hover:text-gold transition-colors">
                VG+ (Very Good Plus)
              </Link>{" "}
              num preço razoável pode ser excelente. Um em G (Good) com marcas de dedos, arranhões e
              superfície oxidada vai soar pior do que o pior reissue do mercado.
            </p>
            <p>
              Os reissues em 180g ganham quando a label teve acesso às fitas originais, contratou um
              engenheiro competente e prensou numa planta de qualidade. Esses casos existem. Analogue
              Productions, Music Matters, Blue Note Tone Poet, ORG Music e Speakers Corner têm
              histórico de fazer isso com seriedade. O problema é que não basta ser 180g para ser um
              desses casos.
            </p>
            <p>
              A pergunta certa na hora de comprar é: qual foi a fonte usada para masterizar esse
              reissue? Fitas originais? Cópia de segunda geração? Arquivo digital derivado de CD?
              Essa resposta vale mais do que qualquer dado de gramatura.
            </p>
          </div>

          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            {[
              {
                label: "Original pode ser melhor quando",
                color: "text-patina",
                items: [
                  "Está em boa condição (VG+ ou melhor)",
                  "O reissue foi feito de fonte digital, não das fitas",
                  "A prensagem original é de planta renomada (UK, Alemanha, Japão)",
                  "O preço do reissue não justifica a diferença",
                ],
              },
              {
                label: "Reissue 180g pode ser melhor quando",
                color: "text-gold",
                items: [
                  "Originais bem conservados estão inacessíveis ou muito caros",
                  "O reissue foi masterizado das fitas originais por engenheiro renomado",
                  "A label tem histórico comprovado (AP, Music Matters, Tone Poet)",
                  "Você prioriza durabilidade para a coleção a longo prazo",
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

        {/* 6 */}
        <section id="para-quem-faz-sentido">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Para Quem o 180g Faz Sentido e Para Quem Não Faz
          </h2>
          <div className="space-y-4 text-parchment text-base leading-relaxed mb-6">
            <p>
              Nada disso significa que o 180g é um golpe ou que você nunca deveria pagar por ele.
              Significa que o peso é uma condição necessária mas não suficiente. Há situações em que
              ele faz sentido claro e situações em que você está pagando pelo peso sem levar nada
              a mais no som.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                label: "Faz sentido",
                color: "text-patina",
                items: [
                  "Você coleciona a longo prazo e a resistência ao empenamento é prioridade",
                  "Você mora em região quente e não tem controle perfeito de temperatura",
                  "Seu toca-discos tem VTA ajustável ou você usa tapete de compensação",
                  "O reissue vem de label com histórico comprovado e fonte de fita original",
                  "Seu sistema é de entrada ou intermediário, onde a estabilidade mecânica extra ajuda mais",
                ],
              },
              {
                label: "Não faz sentido",
                color: "text-red-400",
                items: [
                  "Você está pagando o premium só pelo número na capa, sem pesquisar a masterização",
                  "O original está disponível em bom estado por preço igual ou menor",
                  "Seu toca-discos tem braço fixo e você não usa tapete de compensação",
                  "A label não informa a fonte da masterização",
                  "Você guarda a coleção em ambiente bem controlado onde empenamento não é risco real",
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

        {/* 7 */}
        <section id="como-identificar">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Como Identificar um 180g Feito com Cuidado (e Não Só Pesado)
          </h2>
          <p className="text-parchment text-base leading-relaxed mb-6">
            O selo de 180g na capa não é garantia de nada. O que você quer saber antes de comprar
            está em outros lugares.
          </p>
          <div className="space-y-4">
            {[
              {
                title: "Verifique o engenheiro de masterização",
                text: "A informação fica no encarte ou na página do disco no Discogs, nos campos \"Mastered By\" ou \"Notes\". Kevin Gray, Ryan K. Smith, Bernie Grundman, Chris Bellman e Miles Showell são nomes com reputação estabelecida na comunidade. Não é uma lista exaustiva, mas são referências confiáveis.",
              },
              {
                title: "Procure a origem da fonte",
                text: "\"Mastered from the original analog tapes\" ou \"lacquer cut from original master tapes\" são as informações que você quer ver. Falta de informação sobre a fonte é um sinal de alerta. Nenhuma label séria omite isso porque é um argumento de venda forte.",
              },
              {
                title: "Pesquise a fábrica de prensagem",
                text: "Plantas como Quality Record Pressings (QRP), Record Technology Inc. (RTI), Pallas e Optimal Media têm reputação sólida. Muitas labels sérias mencionam a planta no encarte ou nas notas do Discogs. Planta desconhecida ou não informada é neutro no melhor caso.",
              },
              {
                title: "Consulte as reviews no Discogs antes de comprar",
                text: "A aba de reviews dos releases no Discogs é subutilizada por quem está comprando. Audiófilos documentam se o reissue soa bem ou mal, se a fonte parece digital, se tem ruído de superfície. São cinco minutos de pesquisa que evitam meses de arrependimento.",
              },
              {
                title: "Desconfie de quem não informa nada",
                text: "Se a capa tem \"180g audiophile pressing\" em destaque mas o encarte não cita engenheiro, planta nem fonte, provavelmente é marketing de peso sem qualidade por trás. Labels que investem de verdade em qualidade têm orgulho de informar cada detalhe do processo.",
              },
            ].map(({ title, text }, i) => (
              <div key={i} className="bg-sleeve border border-groove rounded-xl p-5">
                <h3 className="font-display text-base font-bold text-cream mb-3">
                  <span className="text-gold mr-2">{i + 1}.</span>
                  {title}
                </h3>
                <p className="text-parchment text-base leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
          <p className="text-dust text-xs leading-relaxed mt-4">
            Para comparar reissues com prensagens originais e verificar reputação de engenheiros e
            fábricas, a{" "}
            <a
              href="https://www.discogs.com"
              rel="nofollow noopener noreferrer"
              target="_blank"
              className="underline hover:text-gold transition-colors"
            >
              base de dados do Discogs
            </a>
            {" "}é o recurso mais completo disponível gratuitamente.
          </p>
        </section>

        {/* 8 — FAQ */}
        <section id="faq">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Perguntas Frequentes Sobre Vinil 180g
          </h2>
          <div className="space-y-4">
            {FAQ.map(({ q, a }) => (
              <details
                key={q}
                className="bg-sleeve border border-groove rounded-xl group"
              >
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
              O Peso Não Define. O Processo Define.
            </h2>
            <div className="space-y-3 text-parchment text-base leading-relaxed">
              <p>
                O vinil 180g tem benefícios reais: resiste mais ao empenamento, oferece mais
                estabilidade mecânica e com frequência vem acompanhado de maior cuidado no processo
                de prensagem. Mas esses benefícios não estão no peso em si. Estão nas decisões que
                algumas labels tomam quando investem em 180g de verdade.
              </p>
              <p>
                A gramatura virou um atalho cognitivo. Pesado parece melhor. E às vezes é. Mas um
                disco de 120g masterizado por um engenheiro competente a partir de fitas originais,
                prensado numa planta de qualidade, vai soar melhor do que qualquer 180g feito com
                atalhos de produção. O número na capa não garante nada por si só.
              </p>
              <p>
                Pesquise antes de comprar. Descubra de onde veio a masterização. Cuide do VTA se o
                seu braço permite. E não descarte um original bem conservado só porque pesa menos.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/discos-abaixo-de-200"
                className="inline-flex items-center gap-1.5 bg-gold/10 border border-gold/30 text-gold text-xs font-semibold px-4 py-2 rounded-full hover:bg-gold/20 transition-colors"
              >
                Ver discos abaixo de R$200
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
              { href: "/guias/vinil-colorido-e-picture-disc", title: "Vinil Colorido e Picture Disc Valem a Pena?", desc: "Mito vs. realidade técnica: carbon black, polietileno e quando cada formato compensa." },
              { href: "/guias/como-avaliar-estado-disco-vinil", title: "Como Avaliar o Estado de um Disco de Vinil", desc: "Pra decidir entre original de sebo e reissue, comece sabendo graduar." },
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
