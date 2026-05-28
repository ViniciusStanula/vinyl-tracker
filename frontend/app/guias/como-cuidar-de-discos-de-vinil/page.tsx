import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

function IconWarning({ className = "" }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path d="M7 1.5L12.5 11.5H1.5L7 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 5.5V7.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="7" cy="9.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://garimpavinil.com.br";
const SLUG = "como-cuidar-de-discos-de-vinil";
const PAGE_TITLE = "Como Cuidar de Discos de Vinil: Guia Completo Para Sua Coleção Durar Décadas";
const PAGE_DESC =
  "Guia de limpeza, armazenamento no clima do Brasil, cuidados com agulha e checklist de manutenção para sua coleção de vinil durar décadas.";
const DATE = "2026-05-27";

export const metadata: Metadata = {
  title: "Como Cuidar de Discos de Vinil: Guia Completo | Garimpa Vinil",
  description: PAGE_DESC,
  alternates: { canonical: `/guias/${SLUG}` },
  openGraph: {
    type: "article",
    title: PAGE_TITLE,
    description: PAGE_DESC,
    url: `/guias/${SLUG}`,
    images: [{ url: `${SITE_URL}/blog/como-cuidar-de-discos-de-vinil.jpg`, width: 6000, height: 4000, alt: "Agulha Philips sobre disco de vinil girando no prato do toca-discos" }],
  },
  twitter: { card: "summary_large_image", title: PAGE_TITLE, description: PAGE_DESC, images: [`${SITE_URL}/blog/como-cuidar-de-discos-de-vinil.jpg`] },
};

const TOC = [
  { id: "por-que-cuidar", label: "Por que cuidar faz diferença" },
  { id: "5-erros", label: "Os 5 erros que mais destroem discos" },
  { id: "manuseio", label: "Como manusear sem danificar" },
  { id: "limpeza", label: "Limpeza passo a passo" },
  { id: "agulha", label: "Cuidados com a agulha" },
  { id: "armazenamento", label: "Armazenamento no clima do Brasil" },
  { id: "plasticos-estantes", label: "Plásticos, capas e estantes" },
  { id: "herdados-sebo", label: "Discos herdados, de sebo ou mofados" },
  { id: "diagnostico", label: "Chiado, estalo e pulo: diagnóstico" },
  { id: "checklist", label: "Checklist de manutenção" },
  { id: "onde-comprar", label: "Onde comprar acessórios no Brasil" },
  { id: "faq", label: "Perguntas frequentes" },
];

const FAQ = [
  {
    q: "Posso limpar disco de vinil com álcool?",
    a: "Álcool puro, não. Álcool isopropílico em concentração baixa (5 a 10%) misturado com água destilada é usado em algumas soluções profissionais, mas o álcool puro resseca o PVC e quebra as arestas microscópicas do sulco, causando perda permanente de fidelidade. Em discos de laca ou acetato (gravações antigas e prensagens de teste), álcool de qualquer concentração está absolutamente proibido.",
  },
  {
    q: "De quanto em quanto tempo devo limpar meus vinis?",
    a: "Escovação seca com fibra de carbono é regra antes de toda audição. Limpeza profunda com água destilada e sabão neutro é necessária em três situações: quando você compra um disco (novo ou usado), depois de longos períodos com o disco parado, ou quando aparecer um chiado novo que a escova seca não resolve.",
  },
  {
    q: "Disco de vinil estraga se ficar parado muito tempo?",
    a: "Em boas condições de armazenamento (vertical, sem sol, sem umidade alta, sem variação de temperatura extrema), um disco de vinil é praticamente eterno. Existem discos de 70 anos que tocam como novos. Em más condições, o estrago pode acontecer em meses: empenamento, mofo, capa amarelada e ressecada.",
  },
  {
    q: "Vinil novo precisa ser limpo antes de tocar?",
    a: "Sim. Mesmo dentro do plástico lacrado, todo disco novo tem resíduo do processo de prensagem na superfície e atraiu estática durante o transporte. Uma escovada com fibra de carbono e, se possível, um pano de microfibra úmido com água destilada antes da primeira audição protegem sua agulha desde a primeira rotação.",
  },
  {
    q: "Como saber se meu disco está empenado?",
    a: "Coloque o disco sobre uma superfície bem plana e olhe de lado. Se as bordas levantam em algum ponto, está empenado. No toca-discos, o braço sobe e desce visivelmente durante a rotação em casos médios e severos. Empenamento leve geralmente toca normal sem problema audível.",
  },
  {
    q: "Disco riscado tem conserto?",
    a: "Depende do tipo de risco. Arranhão muito superficial às vezes melhora com limpeza profunda, porque a sensação de \"risco\" pode ser sujeira impregnada. Já o arranhão que engata a unha de verdade é dano físico permanente no sulco, sem volta possível em casa.",
  },
];

export default function ComoGuardarPage() {
  const articleLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: PAGE_TITLE,
    description: PAGE_DESC,
    datePublished: DATE,
    dateModified: DATE,
    inLanguage: "pt-BR",
    wordCount: 4328,
    articleSection: "Guias",
    keywords: "cuidar de discos de vinil, limpar disco de vinil, armazenar vinil, limpeza vinil, manutenção vinil",
    author: { "@type": "Person", name: "Equipe Garimpa Vinil", url: `${SITE_URL}/sobre` },
    publisher: { "@type": "Organization", name: "Garimpa Vinil", url: SITE_URL },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/guias/${SLUG}` },
    image: { "@type": "ImageObject", url: `${SITE_URL}/blog/como-cuidar-de-discos-de-vinil.jpg`, width: 6000, height: 4000 },
    speakable: { "@type": "SpeakableSpecification", cssSelector: ["h1"] },
  });

  const breadcrumbLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Guias", item: `${SITE_URL}/guias` },
      { "@type": "ListItem", position: 3, name: "Como Cuidar de Discos de Vinil", item: `${SITE_URL}/guias/${SLUG}` },
    ],
  });

  const faqLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  });

  return (
    <main id="main-content" className="max-w-4xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqLd }} />

      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-dust flex gap-2 flex-wrap">
        <Link href="/" className="hover:text-gold transition-colors">Início</Link>
        <span>›</span>
        <Link href="/guias" className="hover:text-gold transition-colors">Guias</Link>
        <span>›</span>
        <span className="text-parchment">Como Cuidar de Discos de Vinil</span>
      </nav>

      {/* Hero */}
      <header className="relative mb-8 overflow-hidden rounded-2xl bg-sleeve border border-groove px-6 py-7 vinyl-grooves">
        <span className="text-xs font-semibold border rounded-full px-2.5 py-0.5 text-deallit border-deal/30 bg-deal/10 mb-4 inline-block">
          Guia
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-black text-cream leading-tight mb-3">
          Como Cuidar de <span className="text-gold">Discos de Vinil</span>
        </h1>
        <p className="text-parchment text-sm max-w-2xl leading-relaxed">
          Guia completo: limpeza, armazenamento no clima do Brasil, cuidados com a agulha, os 5
          erros que destroem coleções e checklist de manutenção. Tudo que você precisa para sua
          coleção durar décadas.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-dust">
          <span>
            Publicado em{" "}
            <time dateTime={DATE} className="text-parchment">
              27 de maio de 2026
            </time>
          </span>
          <span className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.25" />
              <path d="M6 3.5V6.5L7.5 8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            </svg>
            Leitura: ~15 min
          </span>
        </div>
      </header>

      {/* Hero image */}
      <figure className="mb-8 rounded-2xl overflow-hidden">
        <Image
          src="/blog/como-cuidar-de-discos-de-vinil.jpg"
          alt="Agulha Philips sobre disco de vinil girando no prato do toca-discos"
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

      {/* Article Content */}
      <div className="space-y-10">

        {/* 1 */}
        <section id="por-que-cuidar">
          <h2 className="font-display text-2xl font-bold text-cream mb-5">
            Por Que Cuidar do Vinil Faz Mais Diferença do Que Você Imagina
          </h2>
          <div className="space-y-4 text-parchment text-base leading-relaxed">
            <p>
              Um LP de 12 polegadas tem aproximadamente 500 metros de sulco gravado — meio
              quilômetro em espiral, com largura de cerca de 0,04 mm, menor que um fio de cabelo
              humano. Quando o disco é prensado, a vibração do áudio original é traduzida em
              pequenas ondulações nas paredes desse sulco: quanto mais grave o som, mais larga a
              ondulação; quanto mais agudo, mais fina. Na hora de tocar, a agulha de diamante
              percorre esses 500 metros a 33⅓ rpm e &quot;lê&quot; cada ondulação como vibração mecânica,
              que vira sinal elétrico, que vira música. É um processo absurdamente delicado — e é
              exatamente por isso que qualquer descuido no manuseio, na limpeza ou no armazenamento
              deixa marca permanente.
            </p>
            <p>
              E muitos desses discos carregam um valor emocional por cima do som. Foram herdados
              dos pais, dos avós, comprados numa viagem, achados num sebo num dia de sorte. Por
              isso cuidar bem do vinil é tão importante. Esse cuidado é o que vai diferenciar o
              disco que toca como novo daqui a 40 anos do disco que já soa cansado em poucos meses.
            </p>
          </div>
        </section>

        {/* 2 */}
        <section id="5-erros">
          <h2 className="font-display text-2xl font-bold text-cream mb-5">
            Os 5 Erros Que Mais Destroem Discos de Vinil
          </h2>
          <p className="text-parchment text-base leading-relaxed mb-6">
            Antes de partir pro guia completo, vale listar o que está provavelmente matando seus
            discos agora. Se você faz qualquer uma das coisas a seguir, precisa parar antes de
            qualquer outra coisa.
          </p>
          <figure className="my-4 rounded-xl overflow-hidden">
            <Image
              src="https://images.pexels.com/photos/4433316/pexels-photo-4433316.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Discos de vinil empilhados na horizontal sobre uma superfície, mostrando armazenamento incorreto"
              width={800}
              height={1067}
              className="w-full object-cover max-h-72"
            />
            <figcaption className="text-xs text-dust mt-2 px-1">Armazenamento horizontal — o peso comprime os discos inferiores e causa empenamento permanente.</figcaption>
          </figure>
          <div className="space-y-4">
            {[
              {
                title: "Empilhar os LPs na horizontal",
                text: "Quando você apoia os discos uns sobre os outros, o peso acumulado comprime as bolachas de baixo e gera o temido empenamento. O disco fica torto e a agulha começa a subir e descer durante a reprodução. Em casos leves, o próprio peso do disco no prato pode ajudar a corrigir com o tempo. Em casos médios e severos, muito disco empenado simplesmente não volta ao normal. Guarde sempre na vertical, encostados mas sem comprimir uns aos outros.",
              },
              {
                title: "Tocar com a agulha gasta ou mal ajustada",
                text: "A agulha gasta é uma lâmina arrastando no sulco. Ela não toca, corta. E o problema é maior do que parece, porque uma agulha ruim não estraga um disco, estraga todos os que você tocar com ela. Limpe a agulha antes ou depois de cada audição com uma escova específica de stylus. A maioria das agulhas dura entre 150 e 1.000 horas de uso, dependendo do material da ponta.",
              },
              {
                title: "Guardar perto de janela, parede quente ou área úmida",
                text: "Calor amolece o vinil, sol desbota a capa, e umidade traz mofo, fungo e cheiro de bolor que entra nos sulcos. Se sua estante fica perto de uma parede que pega sol da tarde, isso precisa mudar o quanto antes. Faça o teste prático: encoste a mão na parede atrás dos discos no fim da tarde. Se está quente, esse calor está sendo transferido pra coleção inteira o ano todo.",
              },
              {
                title: "Limpar com pano de cozinha, álcool ou produto químico",
                text: "Álcool puro resseca o PVC e quebra as arestas do sulco, o que significa perda permanente de fidelidade. Pano de cozinha e camiseta velha soltam fiapos que ficam presos nos sulcos. Qualquer produto com fragrância, álcool perfumado ou multiuso deixa resíduo químico que vai grudar poeira pra sempre. Pra limpeza leve, escova de fibra de carbono. Pra limpeza pesada, água destilada com uma gota de sabão neutro e pano de microfibra.",
              },
              {
                title: "Pegar o disco com a mão no sulco",
                text: "Mesmo de mão \"limpa\", nossos dedos têm uma camada natural de oleosidade somada a resíduo do celular, do volante do carro, do que você comeu antes. Essa gordura gruda poeira igual fita adesiva e escorrega pra dentro do sulco onde escova nenhuma alcança. A regra é simples: segure o disco apenas pelas bordas, com a palma da mão, ou apoiando o dedo no selo central de papel. Nunca encostando na parte preta gravada.",
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
        </section>

        {/* 3 */}
        <section id="manuseio">
          <h2 className="font-display text-2xl font-bold text-cream mb-5">
            Como Manusear um Disco de Vinil Sem Danificar os Sulcos
          </h2>
          <div className="space-y-6 text-parchment text-base leading-relaxed">
            <p>
              Essa é provavelmente a parte mais simples do cuidado com vinil, e também a mais
              negligenciada. A regra que vale pra vida toda é simples: as mãos ficam sempre nas
              bordas.
            </p>
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                A regra das bordas e do selo central
              </h3>
              <p>
                A forma correta de segurar um disco é com o polegar apoiado em uma das bordas e os
                outros dedos na borda oposta, deixando o disco &quot;suspenso&quot; entre as duas pontas dos
                dedos. Quando precisar de mais firmeza, o ponto extra de apoio é o selo central de
                papel, nunca a parte preta gravada.
              </p>
              <p className="mt-2">
                A lógica é direta: a borda e o selo central são as únicas áreas do disco onde não
                há áudio gravado. Toda a música está naqueles sulcos microscópicos da parte preta,
                e é exatamente ali que a gordura do dedo vira ruído permanente.
              </p>
              <figure className="mt-4 rounded-xl overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/6867602/pexels-photo-6867602.jpeg?auto=compress&cs=tinysrgb&w=800"
                  alt="Mãos segurando disco de vinil pelas bordas, com os dedos na borda e o polegar no verso, sem tocar a área gravada"
                  width={800}
                  height={1067}
                  className="w-full object-cover max-h-72"
                />
                <figcaption className="text-xs text-dust mt-2 px-1">Forma correta: polegar e dedos apenas nas bordas, sem encostar na parte preta gravada.</figcaption>
              </figure>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Como tirar e guardar o disco da capa sem forçar
              </h3>
              <p>
                Incline a capa com a abertura virada um pouco pra baixo, deixe o disco deslizar
                parcialmente pra fora junto com o plástico interno, e segure pela borda assim que
                ele aparecer. Nunca enfile o dedo no buraco central pra puxar — esse gesto risca o
                selo, estressa o vinil no ponto mais frágil e ainda força o plástico interno a
                dobrar.
              </p>
              <figure className="mt-4 rounded-xl overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/6827183/pexels-photo-6827183.jpeg?auto=compress&cs=tinysrgb&w=800"
                  alt="Pessoa retirando um disco de vinil da capa em uma loja de discos, com a mão segurando pela borda"
                  width={800}
                  height={600}
                  className="w-full object-cover max-h-72"
                />
                <figcaption className="text-xs text-dust mt-2 px-1">Retire o disco inclinando a capa — nunca enfilando o dedo no buraco central.</figcaption>
              </figure>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Por que a gordura do dedo é pior do que poeira
              </h3>
              <p>
                Poeira é um problema fácil de resolver: uma escovada com fibra de carbono antes de
                tocar e está limpo. Gordura é outra história. A oleosidade natural da pele escorre
                pra dentro do sulco, onde nenhuma escova alcança, e ali ela vira cola para todo o
                pó que passar perto. Depois de algumas audições com o disco contaminado, o resultado
                é audível e definitivo: o som fica abafado, os agudos perdem brilho, e aparece um
                estalo de fundo que não sai mais nem com limpeza profunda.
              </p>
            </div>
          </div>
        </section>

        {/* 4 */}
        <section id="limpeza">
          <h2 className="font-display text-2xl font-bold text-cream mb-5">
            Como Limpar Discos de Vinil em Casa?
          </h2>
          <p className="text-parchment text-sm leading-relaxed mb-3 bg-sleeve border border-groove rounded-xl px-4 py-3">
            Use escova de fibra de carbono antes de cada audição para remover poeira e estática.
            Para limpeza profunda, misture água destilada com uma gota de sabão neutro em 500 ml;
            aplique com microfibra em movimentos circulares seguindo o sulco; seque por 20–30
            minutos em pé. Nunca álcool puro, pano de cozinha ou produto com fragrância.
          </p>
          <figure className="my-4 rounded-xl overflow-hidden">
            <Image
              src="https://images.pexels.com/photos/6863085/pexels-photo-6863085.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Disco de vinil no prato do toca-discos com poeira iridescente visível sobre a superfície preta"
              width={800}
              height={1200}
              className="w-full object-cover max-h-72"
            />
            <figcaption className="text-xs text-dust mt-2 px-1">Poeira e partículas estáticas acumuladas — visíveis como brilho iridescente. Uma escovada antes de tocar resolve isso em segundos.</figcaption>
          </figure>
          <p className="text-parchment text-base leading-relaxed mb-6">
            Existem três níveis diferentes de limpeza de disco. A regra simples é casar o nível de
            limpeza com o estado do disco. Do mais leve pro mais pesado:
          </p>
          <div className="space-y-6">
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Limpeza rápida antes de cada audição
              </h3>
              <div className="space-y-3 text-parchment text-base leading-relaxed">
                <p>
                  Coloca o LP no prato, liga a rotação, segura uma escova de fibra de carbono
                  apoiada de leve na superfície e deixa o disco girar duas ou três voltas completas
                  embaixo das cerdas. Pronto.
                </p>
                <p>
                  A função é dupla: tirar a poeira acumulada e descarregar a estática que se forma
                  na superfície do vinil. Disco com estática é disco que atrai poeira do ar enquanto
                  toca. Faça antes de cada audição, sem exceção — cinco segundos de esforço que
                  poupam horas de limpeza profunda no futuro.
                </p>
              </div>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Limpeza profunda com água destilada e sabão neutro
              </h3>
              <figure className="mb-4 rounded-xl overflow-hidden">
                <Image
                  src="https://images.pexels.com/photos/6873716/pexels-photo-6873716.jpeg?auto=compress&cs=tinysrgb&w=800"
                  alt="Mão limpando disco de vinil com pano de microfibra azul em movimentos circulares acompanhando o sulco"
                  width={800}
                  height={1067}
                  className="w-full object-cover max-h-72"
                />
                <figcaption className="text-xs text-dust mt-2 px-1">Movimentos circulares acompanhando o sulco, pano de microfibra — nunca atravessando de uma borda à outra.</figcaption>
              </figure>
              <div className="space-y-3 text-parchment text-base leading-relaxed">
                <p>Esse nível é obrigatório em três situações:</p>
                <ul className="list-disc list-inside space-y-1 text-parchment ml-2">
                  <li>Disco novo de sebo ou usado, antes da primeira audição na sua casa</li>
                  <li>Disco antigo da sua coleção que nunca passou por uma lavagem decente</li>
                  <li>Disco que está chiando mesmo depois da escovação</li>
                </ul>
                <p>
                  A receita: água destilada (jamais da torneira — o cloro deixa resíduo nos sulcos)
                  com uma única gota de sabão neutro em meio litro de água. Aplique com pano de
                  microfibra novo em movimentos circulares acompanhando o sulco, nunca atravessando
                  de uma borda à outra. Proteja o selo central. Para secar, apoie o disco em pé num
                  escorredor de louça, longe de sol direto, por 20 a 30 minutos. Só guarde quando
                  estiver completamente seco.
                </p>
              </div>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Quando vale a pena investir em máquina de limpeza
              </h3>
              <div className="grid sm:grid-cols-3 gap-3 text-parchment text-sm">
                {[
                  { label: "Manuais a água", desc: "Funciona como banheirinha com escovas internas. Barata, simples, resolve até uns 300 discos sem dor de cabeça. Ponto de entrada ideal pra maioria dos colecionadores brasileiros." },
                  { label: "A vácuo", desc: "Aplica a solução, escova e suga o líquido junto com a sujeira. Resultado excelente e processo rápido por disco. Custa caro. Só faz sentido pra quem tem 500+ discos ou compra muito em sebo." },
                  { label: "Ultrassônicas", desc: "Nível mais alto. Usa cavitação por ondas sonoras na água pra desalojar sujeira de dentro do sulco sem fricção mecânica. Resultado superior, principalmente em discos muito sujos. Caras e mais técnicas de operar." },
                ].map(({ label, desc }) => (
                  <div key={label} className="bg-sleeve border border-groove rounded-xl p-4">
                    <p className="font-semibold text-cream text-xs mb-1">{label}</p>
                    <p className="text-xs leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                O método da cola de madeira: funciona mesmo ou estraga o disco?
              </h3>
              <div className="space-y-3 text-parchment text-base leading-relaxed">
                <p>
                  A cola líquida penetra no sulco, seca como um molde negativo, e quando você puxa
                  ela traz a sujeira impregnada junto. Em discos completamente perdidos, com sujeira
                  pesada de décadas, o resultado pode ser surpreendente.
                </p>
                <p>
                  O problema é tudo que pode dar errado. Cola errada, cola com aditivo, cola
                  colorida, cola que seca de jeito errado por causa da umidade do ambiente — qualquer
                  um desses fatores gruda permanentemente no sulco e o disco vira lixo. Só faz
                  sentido em disco que você já considera perdido. Em qualquer disco que você gosta ou
                  que tem valor de coleção, fica longe.
                </p>
              </div>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Por que limpar até disco lacrado novo antes da primeira audição
              </h3>
              <p className="text-parchment text-base leading-relaxed">
                No processo de prensagem, sobra resíduo de compostos de desmolde, micropartículas do
                próprio PVC e às vezes pelos do material que reveste as matrizes. Isso fica na
                superfície do disco mesmo dentro da capa lacrada. Some a isso a estática gerada na
                fábrica, que atrai pó já no caminho do depósito pro frete pra sua casa. Uma
                escovada com fibra de carbono e, se quiser ser caprichoso, um pano de microfibra
                úmido com água destilada protegem sua agulha desde a primeira rotação.
              </p>
            </div>
          </div>
        </section>

        {/* 5 */}
        <section id="agulha">
          <h2 className="font-display text-2xl font-bold text-cream mb-5">
            Como Cuidar da Agulha do Toca-Discos?
          </h2>
          <p className="text-parchment text-sm leading-relaxed mb-3 bg-sleeve border border-groove rounded-xl px-4 py-3">
            Limpe o stylus com escova seca em movimento de trás para frente a cada 2–3 audições.
            Acompanhe as horas de uso: agulhas cônicas duram 150–300 horas; elípticas, 500–800
            horas; microline/Shibata, até 2.000 horas. Com 40 minutos de audição diária, troque a
            agulha elíptica a cada 1–2 anos.
          </p>
          <figure className="my-4 rounded-xl overflow-hidden">
            <Image
              src="https://images.pexels.com/photos/5764288/pexels-photo-5764288.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Cápsula e agulha de toca-discos em close, posicionada sobre disco de vinil em rotação"
              width={800}
              height={450}
              className="w-full object-cover"
            />
            <figcaption className="text-xs text-dust mt-2 px-1">A agulha de diamante percorre 500 metros de sulco — uma ponta gasta corta em vez de ler.</figcaption>
          </figure>
          <p className="text-parchment text-base leading-relaxed mb-6">
            A agulha é o único ponto de contato entre todo o investimento que você fez em discos e
            a música que sai das caixas. Uma agulha gasta ou suja não estraga um disco, estraga
            todos. Cada audição com stylus mal cuidado é um arranhão microscópico distribuído pela
            coleção inteira.
          </p>
          <div className="space-y-6">
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Como limpar o stylus corretamente
              </h3>
              <div className="space-y-3 text-parchment text-base leading-relaxed">
                <p>
                  A limpeza padrão é com escova de stylus seca. O movimento é sempre de trás pra
                  frente, no mesmo sentido em que o disco gira sob a agulha. Nunca movimento
                  lateral — a agulha é colada ao cantilever por uma cola específica, e força lateral
                  pode soltar a peça inteira.
                </p>
                <p>
                  Para sujeira teimosa, produtos em gel específicos pra stylus funcionam como uma
                  cama de silicone macio: você baixa o braço com a agulha sobre o gel, deixa
                  pousada uns dois segundos, levanta de volta. A sujeira fica grudada no gel e a
                  agulha sai limpa.
                </p>
                <div className="bg-sleeve border border-groove rounded-xl p-4">
                  <p className="font-semibold text-cream text-xs mb-2">O que NÃO fazer:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-parchment">
                    <li>Encostar o dedo na agulha — gordura na ponta de diamante vira ruído em todos os discos</li>
                    <li>Usar álcool puro ou qualquer líquido que não seja produto específico de stylus — pode dissolver a cola do cantilever</li>
                    <li>Escova úmida — o líquido escorre pra dentro da cápsula e pode danificar a bobina</li>
                  </ul>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Quanto tempo dura uma agulha e como saber que ela já era
              </h3>
              <div className="space-y-3 text-parchment text-base leading-relaxed">
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    { label: "Cônica / safira", horas: "150–300 h", desc: "Mais barata. Padrão de entrada." },
                    { label: "Elíptica / diamante", horas: "500–800 h", desc: "Padrão hi-fi de entrada. Mais comum." },
                    { label: "Microlinha / Shibata", horas: "1.000–2.000 h", desc: "Perfis avançados. Custam mais." },
                  ].map(({ label, horas, desc }) => (
                    <div key={label} className="bg-sleeve border border-groove rounded-xl p-4 text-center">
                      <p className="font-semibold text-cream text-xs mb-0.5">{label}</p>
                      <p className="text-gold font-bold text-sm mb-1">{horas}</p>
                      <p className="text-xs text-parchment">{desc}</p>
                    </div>
                  ))}
                </div>
                <p>
                  Conversão prática: se você ouve um disco por dia (uns 40 min), uma agulha elíptica
                  mediana vai durar entre 1 e 2 anos.
                </p>
                <p className="text-xs text-dust">
                  Estimativas de vida útil baseadas nas faixas estabelecidas pela indústria e no{" "}
                  <a
                    href="https://ortofon.com/blogs/news/when-to-replace-the-stylus-of-your-phono-cartridge"
                    rel="nofollow noopener noreferrer"
                    target="_blank"
                    className="underline hover:text-gold transition-colors"
                  >
                    guia oficial da Ortofon sobre substituição de agulhas
                  </a>
                  .
                </p>
                <div>
                  <p className="font-semibold text-cream text-xs mb-2">Sinais de que a agulha já era:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-parchment">
                    <li>Chiado novo aparecendo em discos que sempre tocaram limpos</li>
                    <li>Perda de brilho nos agudos, som que parece &quot;abafado&quot;</li>
                    <li>Distorção em passagens de volume alto, principalmente em vocais femininos</li>
                    <li>Sibilância exagerada — S e Z chiando feio em vez de soarem limpos</li>
                  </ul>
                </div>
                <p>
                  Se você comprou um toca-discos usado, troque a agulha por padrão antes da
                  primeira audição. Você não tem como saber quantas horas ela já tem.
                </p>
              </div>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Peso de rastreio e antiskating: o ajuste que ninguém faz e todo mundo deveria
              </h3>
              <div className="space-y-3 text-parchment text-base leading-relaxed">
                <p>
                  <strong className="text-cream">Peso de rastreio</strong> é a pressão que a agulha
                  exerce sobre o sulco. Cada cápsula tem uma faixa ideal especificada pelo
                  fabricante, geralmente entre 1,5 e 2,5 gramas. Peso menor faz a agulha pular nas
                  passagens mais intensas. Peso maior força a ponta contra o vinil e acelera o
                  desgaste físico de tudo.
                </p>
                <p>
                  <strong className="text-cream">Antiskating</strong> é a força que compensa a
                  tendência natural do braço de ser puxado em direção ao centro do disco. Antiskating
                  mal ajustado desgasta um lado do sulco mais que o outro.
                </p>
                <p>
                  Para ajustar: (1) procure a especificação exata da sua cápsula no manual; (2) use
                  uma balança de agulha digital pra medir o peso real; (3) iguale o valor do
                  antiskating ao do peso — não é exato matematicamente, mas é o ponto de partida
                  correto na esmagadora maioria dos toca-discos.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6 */}
        <section id="armazenamento">
          <h2 className="font-display text-2xl font-bold text-cream mb-5">
            Como Armazenar Vinil no Clima do Brasil
          </h2>
          <p className="text-parchment text-sm leading-relaxed mb-3 bg-sleeve border border-groove rounded-xl px-4 py-3">
            Guarde discos na vertical, em ambiente abaixo de 30°C e umidade entre 35–65%. No
            Brasil, evite paredes que pegam sol da tarde, porões e áreas úmidas. Um higrômetro
            digital perto da estante é mais importante do que qualquer acessório de limpeza — sem
            medir a umidade, você não consegue gerenciar o que está acontecendo com a coleção.
          </p>
          <p className="text-parchment text-base leading-relaxed mb-6">
            Boa parte da literatura sobre conservação de vinil que circula online foi escrita
            pensando em apartamento europeu com 18°C estáveis e umidade controlada. No Brasil real
            — Manaus a 90% de umidade, Rio em fevereiro, São Paulo com sol da tarde rachando a
            parede — essas regras precisam de adaptação.
          </p>
          <div className="space-y-6">
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Temperatura e umidade ideais
              </h3>
              <p className="text-parchment text-base leading-relaxed">
                A faixa técnica recomendada por arquivistas é de 15 a 20°C e 35 a 45% de umidade
                relativa — padrão próximo ao definido pelas{" "}
                <a
                  href="https://www.loc.gov/preservation/care/record.html"
                  rel="nofollow noopener noreferrer"
                  target="_blank"
                  className="underline hover:text-gold transition-colors"
                >
                  diretrizes de preservação da Biblioteca do Congresso dos EUA
                </a>
                . No Brasil, o objetivo realista é outro: evitar os extremos. Acima de 30°C
                constante o vinil começa a amolecer e a empenar com o próprio peso. Acima de 65% de
                umidade constante o mofo começa a aparecer nas capas e migra pros discos.
              </p>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Sol, parede quente e janela
              </h3>
              <div className="space-y-3 text-parchment text-base leading-relaxed">
                <p>
                  Sol direto é o assassino mais rápido. Capa colorida desbota em meses, e em casos
                  extremos o vinil pode amolecer em semanas. Não exponha. Nunca.
                </p>
                <p>
                  Parede quente é o vilão sutil. Aquela parede que pega sol da tarde transmite calor
                  pra dentro do cômodo durante horas mesmo depois do sol ter passado. Faça o teste
                  prático: encoste a palma da mão na parede atrás da estante por volta das cinco da
                  tarde num dia quente. Se está visivelmente quente, mude a estante de lugar.
                </p>
              </div>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Situações brasileiras que pedem cuidado redobrado
              </h3>
              <div className="grid sm:grid-cols-3 gap-3 text-parchment text-sm">
                {[
                  { label: "Casa de litoral", desc: "Maresia + umidade alta. Mofo nas capas e oxidação em componentes metálicos do toca-discos são quase garantidos sem prevenção ativa." },
                  { label: "Casa cercada de mato", desc: "Umidade do solo sobe pelas paredes por capilaridade. Estante encostada em parede assim é problema na certa." },
                  { label: "Porão ou garagem", desc: "Praticamente proibidos. Variação térmica enorme, umidade quase sempre alta, poeira pesada." },
                ].map(({ label, desc }) => (
                  <div key={label} className="bg-sleeve border border-groove rounded-xl p-4">
                    <p className="font-semibold text-cream text-xs mb-1">{label}</p>
                    <p className="text-xs leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Desumidificador, sílica gel e ar-condicionado valem a pena?
              </h3>
              <div className="space-y-3 text-parchment text-base leading-relaxed">
                <p>
                  <strong className="text-cream">Desumidificador elétrico:</strong> em região úmida
                  vale cada centavo, principalmente no verão. Modelos pequenos pra cômodo único têm
                  preço acessível no mercado brasileiro. Para verificar a umidade média histórica da
                  sua cidade, consulte as{" "}
                  <a
                    href="https://portal.inmet.gov.br/normais"
                    rel="nofollow noopener noreferrer"
                    target="_blank"
                    className="underline hover:text-gold transition-colors"
                  >
                    Normais Climatológicas do INMET
                  </a>
                  .
                </p>
                <p>
                  <strong className="text-cream">Sílica gel:</strong> saquinhos espalhados pela
                  estante absorvem umidade de forma passiva. Custa quase nada, mas precisa ser
                  regenerado ou trocado a cada dois ou três meses. Funciona como complemento, não
                  como solução principal.
                </p>
                <p>
                  <strong className="text-cream">Ar-condicionado:</strong> ajuda muito quando ligado,
                  mas a variação brusca de ligado pra desligado pode gerar ciclos de condensação.
                </p>
                <p>
                  O melhor investimento de todos, que custa menos do que um disco novo: um{" "}
                  <strong className="text-cream">higrômetro digital</strong>. Sem medir a umidade,
                  você não consegue gerenciar nada. Coloque um perto da estante e olhe de vez em
                  quando.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 7 */}
        <section id="plasticos-estantes">
          <h2 className="font-display text-2xl font-bold text-cream mb-5">
            Plásticos, Capas e Estantes: Montando o Lar Certo Para Sua Coleção
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Plástico interno: papel, poly ou paper com lining?
              </h3>
              <div className="grid sm:grid-cols-3 gap-3 text-parchment text-sm">
                {[
                  { label: "Papel puro", nota: "Evite", notaColor: "text-red-400", desc: "Vem de fábrica na maioria dos discos. Solta fibras com o tempo, é abrasivo contra o vinil e contribui pra acumular estática. Troque em TODO disco novo que você comprar." },
                  { label: "Poly puro", nota: "Bom", notaColor: "text-patina", desc: "Macio, antiestático, completamente liso. O melhor pro disco em termos de proteção. Contra: desliza demais dentro da capa." },
                  { label: "Paper com lining", nota: "Ideal", notaColor: "text-gold", desc: "Por fora é papel (dá rigidez), por dentro tem camada de poly que toca o disco. Preferido por colecionadores sérios. Resolve os dois lados do problema." },
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
                Plástico externo: precisa mesmo?
              </h3>
              <div className="space-y-3 text-parchment text-base leading-relaxed">
                <p>
                  O plástico externo não protege o disco. Protege a capa. Sua função é defender o
                  papelão de poeira, atrito entre capas vizinhas na estante, manchas e umidade
                  superficial.
                </p>
                <p>
                  Se você se importa com valor de revenda, com edições limitadas ou capas raras,
                  sim, sempre. No clima brasileiro, com umidade alta na maior parte do ano, o
                  plástico externo prolonga muito a vida das capas — vale mesmo pra quem é casual.
                </p>
              </div>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Estantes e caixas
              </h3>
              <div className="space-y-3 text-parchment text-base leading-relaxed">
                <p>
                  A regra básica: vertical, encostados mas sem comprimir, em móvel que aguente o
                  peso. Um disco de vinil pesa entre 150 e 200 gramas — quinhentos discos chegam a
                  100 quilos. Móvel improvisado ou prateleira de MDF fina não aguenta.
                </p>
                <ul className="list-disc list-inside space-y-1 text-parchment ml-2">
                  <li><strong className="text-cream">Estantes de cubos quadrados:</strong> viraram padrão entre colecionadores, aguentam o peso e cabem LPs com folga mínima</li>
                  <li><strong className="text-cream">Caixas plásticas reforçadas:</strong> solução barata e funcional, empilháveis e fáceis de mover</li>
                  <li><strong className="text-cream">Marcenaria sob medida:</strong> se a coleção vai crescer muito, madeira maciça ou MDF grosso com prateleiras de no máximo 80cm de vão entre apoios</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 8 */}
        <section id="herdados-sebo">
          <h2 className="font-display text-2xl font-bold text-cream mb-5">
            Como Tratar Discos Herdados ou Comprados em Sebo?
          </h2>
          <p className="text-parchment text-base leading-relaxed mb-6 bg-sleeve border border-groove rounded-xl px-4 py-3">
            Inspecione cada disco em ângulo oblíquo contra a luz antes de tocar. Faça limpeza
            profunda com água destilada e sabão neutro em todos — mesmo os que parecem limpos. Só
            descarte após limpar: muitos discos aparentemente perdidos voltam a tocar bem após uma
            boa lavagem. Discos com mofo ativo não devem tocar no seu equipamento sem limpeza
            prévia — o fungo contamina agulha e toca-discos.
          </p>
          <figure className="my-4 rounded-xl overflow-hidden">
            <Image
              src="https://images.pexels.com/photos/2956143/pexels-photo-2956143.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Bancas de discos de vinil em feira ao ar livre com etiquetas ROCK, Paul McCartney e Beatles visíveis"
              width={800}
              height={533}
              className="w-full object-cover"
            />
            <figcaption className="text-xs text-dust mt-2 px-1">Feira e sebo — todo disco comprado aqui precisa de triagem visual e limpeza profunda antes de tocar.</figcaption>
          </figure>
          <div className="space-y-6">
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Triagem antes da limpeza
              </h3>
              <div className="space-y-3 text-parchment text-base leading-relaxed">
                <p>
                  Pegue cada disco individualmente, leve até uma janela ou luminária forte, e gire
                  o disco em ângulo oblíquo em relação à luz. Isso revela arranhões, marcas, riscos
                  profundos e empenamentos que não são visíveis em luz frontal.
                </p>
                <figure className="rounded-xl overflow-hidden">
                  <Image
                    src="https://images.pexels.com/photos/31805824/pexels-photo-31805824.jpeg?auto=compress&cs=tinysrgb&w=800"
                    alt="Disco de vinil visto de lado em ângulo oblíquo, mostrando o perfil da borda para verificar empenamento"
                    width={800}
                    height={800}
                    className="w-full object-cover max-h-56"
                  />
                  <figcaption className="text-xs text-dust mt-2 px-1">Olhe de lado: bordas que levantam em qualquer ponto indicam empenamento.</figcaption>
                </figure>
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    { label: "Salvar", color: "text-green-400", desc: "Sem empenamento visível de lado. Arranhões que não engatam a unha. Superfície reflete de forma uniforme sem pontos opacos irregulares. Limpeza profunda e pode tocar." },
                    { label: "Talvez", color: "text-gold", desc: "Empenamento leve (bordas levantam menos de 2 mm). Arranhões que engatam levemente a unha em 1–2 pontos isolados. Mofo superficial branco ou cinza, não entranhado no sulco. Limpeza profunda com expectativa controlada." },
                    { label: "Descartar (depois)", color: "text-red-400", desc: "Empenamento visível com bordas levantando mais de 3 mm em múltiplos pontos. Arranhões que engatam a unha ao longo de uma faixa inteira. Mas sempre tente limpar antes de jogar fora." },
                  ].map(({ label, color, desc }) => (
                    <div key={label} className="bg-sleeve border border-groove rounded-xl p-4">
                      <p className={`font-semibold text-xs mb-1 ${color}`}>{label}</p>
                      <p className="text-xs leading-relaxed text-parchment">{desc}</p>
                    </div>
                  ))}
                </div>
                <p>
                  Detalhe importante: não jogue nada fora ainda. Alguns discos que parecem perdidos
                  voltam à vida depois de uma limpeza profunda. O descarte é depois de tentar limpar,
                  não antes.
                </p>
              </div>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Como tratar disco com mofo, fungo ou cheiro de bolor
              </h3>
              <div className="space-y-3 text-parchment text-base leading-relaxed">
                <p>
                  Disco com mofo pede limpeza profunda obrigatória antes de qualquer audição. Mofo
                  não é só estético — é fungo vivo que vai contaminar sua agulha, seu toca-discos e
                  o resto da sua coleção.
                </p>
                <p>
                  Procedimento: água destilada com uma gota de sabão neutro, esponja muito macia ou
                  pano de microfibra novo, movimentos circulares acompanhando o sulco. Secagem ao
                  ar livre em ambiente arejado, longe de sol direto. Se possível, deixe o disco
                  &quot;respirar&quot; sem plástico interno por algumas horas antes de guardar.
                </p>
                <p>
                  Quando o cheiro de bolor persiste mesmo depois da limpeza do disco, o problema
                  costuma estar na capa, não no vinil. Papelão absorve odor e devolve com o tempo.
                  Nesses casos, troque capa e plástico interno juntos.
                </p>
                <div className="bg-sleeve border border-groove rounded-xl p-3 text-xs flex gap-2">
                  <IconWarning className="text-gold mt-0.5 shrink-0" />
                  <p><strong className="text-cream">Aviso de saúde:</strong> mofo pesado merece máscara
                  descartável e luva de látex durante o trabalho. Esporo de fungo no pulmão não é
                  problema pequeno.</p>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Discos empenados têm conserto?
              </h3>
              <div className="space-y-3 text-parchment text-base leading-relaxed">
                <p>
                  <strong className="text-cream">Empenamento leve:</strong> aquele que você só nota
                  olhando em ângulo, mas que toca normal no prato. O próprio peso do disco
                  repousando no prato pode corrigir sozinho ao longo de semanas.
                </p>
                <p>
                  <strong className="text-cream">Empenamento médio:</strong> dá pra ouvir, a agulha
                  sobe e desce visivelmente. Existe o método caseiro do disco prensado entre dois
                  vidros lisos ao sol, mas o controle de temperatura é difícil e o risco de piorar
                  é real. Só tente com disco que você não se importa de perder.
                </p>
                <p>
                  <strong className="text-cream">Empenamento severo:</strong> disco visivelmente
                  torto. Existem máquinas específicas de desempenar que aquecem o disco de forma
                  uniforme e controlada entre placas. Funcionam bem, mas custam caro. Honestidade
                  direta: muito disco empenado simplesmente não tem volta.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 9 */}
        <section id="diagnostico">
          <h2 className="font-display text-2xl font-bold text-cream mb-5">
            Chiado, Estalo e Pulo: Como Diagnosticar o Que Está Errado
          </h2>
          <p className="text-parchment text-base leading-relaxed mb-6">
            Existe um mito antigo que diz que chiado faz parte do &quot;charme do vinil&quot;. Não faz.
            Vinil bem cuidado, em equipamento bem ajustado, toca com silêncio entre as faixas que
            surpreende muita gente que só ouviu vinil ruim a vida toda. Se está chiando, alguma
            coisa está errada.
          </p>
          <div className="space-y-6">
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Chiado constante: sujeira ou estática?
              </h3>
              <p className="text-parchment text-base leading-relaxed">
                Faça o teste de eliminação. Escove o disco com fibra de carbono e ouça de novo. Se
                o chiado some ou diminui muito, era poeira somada à estática. Se permanece igual, vá
                pro próximo nível: limpeza profunda com água destilada. Se ainda assim persiste, você
                tem sujeira impregnada no fundo do sulco (só máquina resolve) ou desgaste físico do
                sulco de audições anteriores com agulha gasta (esse não tem volta).
              </p>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Estalo pontual e repetido
              </h3>
              <ul className="space-y-2 text-parchment text-base leading-relaxed">
                <li><strong className="text-cream">Na mesma posição a cada rotação:</strong> arranhão pontual ou sujeira específica nesse ponto. Tente limpeza localizada com pano de microfibra úmido em água destilada.</li>
                <li><strong className="text-cream">Aleatório, espalhado pela faixa toda:</strong> geralmente é agulha suja ou agulha gasta. Limpe o stylus primeiro.</li>
                <li><strong className="text-cream">Aumenta de intensidade conforme o disco toca:</strong> poeira sendo arrastada pela agulha. Pare a reprodução, limpe o stylus, limpe o disco, recomece.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-cream mb-3">
                Quando o problema é o disco, e quando é o toca-discos
              </h3>
              <div className="space-y-3 text-parchment text-base leading-relaxed">
                <p>
                  Quando o mesmo sintoma aparece em vários discos diferentes, o problema não é nos
                  discos, é no equipamento. Possíveis culpados: agulha gasta, agulha mal ajustada,
                  aterramento ruim, cápsula com defeito.
                </p>
                <p>
                  Quando o sintoma só acontece em um disco específico, o problema é nele. Limpeza
                  profunda, e se não resolver, é o estado físico do disco.
                </p>
                <p>
                  Se o som muda significativamente quando você mexe no peso da agulha ou no
                  antiskating, é porque o ajuste estava errado o tempo todo. Muito problema &quot;do
                  disco&quot; some quando o toca-discos está calibrado direito.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 10 */}
        <section id="checklist">
          <h2 className="font-display text-2xl font-bold text-cream mb-5">
            Checklist de Manutenção: Diária, Mensal e Anual
          </h2>
          <p className="text-parchment text-base leading-relaxed mb-6">
            Cuidar de vinil não precisa virar trabalho. Funciona como rotina simples distribuída no
            tempo: cinco segundos por audição, dez minutos por mês, uma tarde por ano.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                label: "Antes e depois de cada audição",
                items: [
                  "Escove o disco com fibra de carbono antes de baixar a agulha",
                  "Escove o stylus a cada 2–3 audições (ou sempre que ver poeira visível)",
                  "Guarde o disco IMEDIATAMENTE depois de ouvir — disco esquecido no prato vira ímã de poeira",
                  "Feche a tampa do toca-discos quando não estiver em uso",
                  "Lave as mãos antes de manusear",
                ],
              },
              {
                label: "Inspeção mensal",
                items: [
                  "Tudo na vertical, nenhum disco tombado, nenhum encostado em fonte de calor?",
                  "Cheque o higrômetro — umidade fora da faixa pede ação imediata",
                  "Passe pano seco em cima das capas pra tirar poeira acumulada",
                  "Reorganize discos que ficaram fora de lugar",
                  "Olhe rapidamente pra qualquer capa que parecer estranha",
                ],
              },
              {
                label: "Revisão anual",
                items: [
                  "Avalie a agulha: quantas horas de uso? Sinais de desgaste?",
                  "Limpeza profunda nos discos mais tocados do ano",
                  "Refaça os ajustes do toca-discos: peso de rastreio, antiskating, nivelamento",
                  "Troque plásticos internos visivelmente gastos, dobrados ou rasgados",
                  "Manutenção profissional do toca-discos a cada 2–3 anos",
                ],
              },
            ].map(({ label, items }) => (
              <div key={label} className="bg-sleeve border border-groove rounded-xl p-5">
                <h3 className="font-display text-sm font-bold text-cream mb-3">{label}</h3>
                <ul className="space-y-2">
                  {items.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-parchment leading-relaxed">
                      <IconCheck className="text-gold mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* 11 */}
        <section id="onde-comprar">
          <h2 className="font-display text-2xl font-bold text-cream mb-5">
            Onde Comprar Acessórios Para Vinil no Brasil
          </h2>
          <p className="text-parchment text-base leading-relaxed mb-4">
            Parte da dificuldade de cuidar de vinil no Brasil é prática: muita orientação online
            aponta pra produto importado que chega aqui com o dobro do preço. Vale separar o que
            faz sentido importar do que tem alternativa nacional decente.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { item: "Escova de fibra de carbono", dica: "Mercado nacional cobre bem. Não precisa importar. Encontra em lojas de hi-fi e vendedores especializados online por preços razoáveis." },
              { item: "Plásticos internos e externos", dica: "Mercado nacional ótimo. Vendedores especializados que vendem em lotes de 50 ou 100 unidades com preço muito melhor do que importação." },
              { item: "Líquido de limpeza profissional", dica: "Importação vale se você usa muito ou tem coleção grande. Pra uso esporádico, a receita caseira de água destilada com sabão neutro resolve sem problema." },
              { item: "Máquinas de limpeza", dica: "Importação direta é cara pelo peso e imposto. Algumas lojas físicas de hi-fi no Brasil trazem o produto. Pesquise em São Paulo, Rio e Belo Horizonte antes de importar." },
              { item: "Agulha de reposição", dica: "Marcas comuns têm distribuidor oficial no Brasil com preços competitivos. Marcas mais raras quase sempre precisam ser importadas. Procure lojas físicas especializadas em hi-fi." },
              { item: "Higrômetro e desumidificador", dica: "Sem necessidade de gastar muito. Higrômetro em loja de aquarismo ou jardinagem. Desumidificador em lojas de eletrodomésticos comuns." },
            ].map(({ item, dica }) => (
              <div key={item} className="bg-sleeve border border-groove rounded-xl p-4">
                <p className="font-semibold text-cream text-xs mb-1">{item}</p>
                <p className="text-parchment text-xs leading-relaxed">{dica}</p>
              </div>
            ))}
          </div>
          <p className="text-parchment text-xs leading-relaxed mt-4">
            Onde procurar conselho honesto: lojas físicas especializadas em hi-fi nas capitais,
            vendedores reputados de longa data em marketplaces, grupos de Facebook e Telegram de
            colecionadores. Esses grupos costumam ser as melhores fontes de indicação porque
            ninguém ganha comissão.
          </p>
        </section>

        {/* 12 — FAQ */}
        <section id="faq">
          <h2 className="font-display text-2xl font-bold text-cream mb-5">
            Perguntas Frequentes Sobre Cuidados Com Disco de Vinil
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

        {/* 13 — Conclusion */}
        <section>
          <div className="bg-sleeve border border-groove rounded-xl p-6">
            <h2 className="font-display text-lg font-bold text-cream mb-3">
              Sua Coleção Merece o Cuidado Que Você Investiu Nela
            </h2>
            <div className="space-y-3 text-parchment text-base leading-relaxed">
              <p>
                Vinil é, no fundo, uma tecnologia que tinha tudo pra ter morrido nos anos 90 e
                voltou justamente porque oferece algo que streaming não dá. Não é só som, é objeto
                físico, capa pra segurar, agulha pra baixar, lado pra virar, ato deliberado de
                ouvir uma faixa do começo ao fim. Cuidar do disco faz parte dessa experiência.
              </p>
              <p>
                Ninguém faz tudo perfeito desde o dia um. O que importa é começar a cuidar agora,
                com os discos que você já tem. Os hábitos se constroem aos poucos, e a coleção
                responde rápido.
              </p>
              <p>
                O disco que você cuida hoje é o mesmo disco que alguém vai ouvir daqui a 40 anos.
                Pode ser você, pode ser seu filho, pode ser um desconhecido que vai achar o LP num
                sebo qualquer e descobrir música através dele.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 bg-gold/10 border border-gold/30 text-gold text-xs font-semibold px-4 py-2 rounded-full hover:bg-gold/20 transition-colors"
              >
                Garimpor discos no Brasil
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

      </div>
    </main>
  );
}
