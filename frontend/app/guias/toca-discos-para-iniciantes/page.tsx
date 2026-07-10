import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

function IconChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className={className}>
      <path d="M3 5.5L7 9.5L11 5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";

const SLUG = "toca-discos-para-iniciantes";
const PAGE_TITLE = "Toca-Discos para Iniciantes: Como Escolher";
const PAGE_DESC =
  "Vitrola de maleta ou toca-discos de verdade? Cápsula, contrapeso, anti-skating e pré-phono explicados, com os modelos que valem a pena na Amazon Brasil.";
const DATE = "2026-07-10";
const DATE_MODIFIED = "2026-07-10";
const HERO_IMAGE = `${SITE_URL}/blog/toca-discos-capsula-agulha.jpg`;
const AFFILIATE_TAG = "garimpa-vinil-20";

export const metadata: Metadata = {
  title: "Toca-Discos para Iniciantes: Como Escolher | Garimpa Vinil",
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
        alt: "Cabeçote, cápsula e agulha de toca-discos em close sobre um disco de vinil, com os pontos estroboscópicos do prato ao fundo",
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
  { id: "a-agulha", label: "A agulha toca o disco. O Bluetooth não." },
  { id: "contrapeso", label: "Contrapeso, anti-skating e por que somem nos baratos" },
  { id: "tracao", label: "Correia ou tração direta" },
  { id: "pre-phono", label: "Pré-amplificador phono: você precisa de um?" },
  { id: "aparelhos", label: "Os aparelhos" },
  { id: "quando-vitrola", label: "Quando a vitrola faz sentido" },
  { id: "faq", label: "Perguntas frequentes" },
];

const APARELHOS = [
  {
    asin: "B07N3XJ66N",
    nome: "Audio-Technica AT-LP60X",
    img: "https://m.media-amazon.com/images/I/414zRaZaoEL._SL500_.jpg",
    desc: "Correia, totalmente automático, cápsula dual magnet com ponta substituível (ATN3600L), pré-phono embutido e selecionável. Não tem contrapeso nem anti-skating, e não faz falta para quem quer apertar um botão e ouvir. É o piso do que dá para chamar de toca-discos.",
  },
  {
    asin: "B07N3S4X3P",
    nome: "Audio-Technica AT-LP120XUSB",
    img: "https://m.media-amazon.com/images/I/41e0XE0dCwL._SL500_.jpg",
    desc: "Tração direta, braço em S balanceado, cabeçote universal AT-HS6, cápsula AT-VM95E de agulha elíptica, pitch com trava de quartzo, saída USB. É o aparelho que aceita upgrade de cápsula e não precisa ser trocado depois.",
  },
  {
    asin: "B0CYHJHN9R",
    nome: "JBL Spinner BT",
    img: "https://m.media-amazon.com/images/I/315Lv7eG2nL._SL500_.jpg",
    desc: "Correia, prato de alumínio, cabeçote removível, Bluetooth com aptX HD. Para quem quer o Bluetooth sem abrir mão da cápsula trocável.",
  },
  {
    asin: "B0DQVNSYLK",
    nome: "Audio-Technica AT-LP70X",
    img: "https://m.media-amazon.com/images/I/41Src9a5moL._SL500_.jpg",
    desc: "Automático, correia, sucessor do LP60X com cápsula VM95C. Faz sentido se a diferença de preço para o LP60X estiver pequena no dia.",
  },
];

const FAQ = [
  {
    q: "Vitrola de maleta estraga disco?",
    a: "A cápsula cerâmica que essas vitrolas usam precisa de mais força sobre o sulco do que uma cápsula magnética, e nenhuma delas informa na ficha a força que aplica. O desgaste é gradual e não volta: a parede do sulco vai perdendo agudo e definição ao longo de dezenas de reproduções. Para um disco que você quer manter, o risco não compensa.",
  },
  {
    q: "Preciso trocar a agulha?",
    a: "Sim. A ponta se desgasta com o uso e passa a machucar o sulco em vez de apenas lê-lo. No AT-LP60X a ponta substituível é a ATN3600L. Nas vitrolas de maleta a cápsula costuma ser peça única, sem reposição fácil, o que na prática significa trocar o aparelho.",
  },
  {
    q: "Bluetooth piora o som do vinil?",
    a: "O Bluetooth converte o sinal analógico em digital e comprime. O JBL Spinner BT usa aptX HD, que comprime menos que o codec padrão. Se você comprou vinil pelo analógico e vai ouvir por Bluetooth, entenda que está desfazendo parte do motivo da compra. Para uso casual, funciona.",
  },
  {
    q: "Para que serve a rotação de 78 rpm?",
    a: "Para discos de goma-laca anteriores aos anos 50. Eles têm sulco mais largo e exigem uma agulha própria, mais grossa. Tocar um 78 com agulha de 33 rpm não funciona bem em nenhum dos dois sentidos: o som sai errado e as duas peças se desgastam.",
  },
  {
    q: "Qual a diferença entre cápsula cerâmica e magnética?",
    a: "A cerâmica gera um sinal elétrico forte deformando um cristal, o que dispensa pré-amplificador e barateia o aparelho. Para arrancar esse sinal, a agulha precisa empurrar a parede do sulco com força. A magnética gera um sinal fraco por indução, precisa de um pré-phono e pisa mais leve no disco. Toda a diferença de preço entre uma vitrola e um toca-discos de entrada está aí.",
  },
];

export default function TocaDiscosIniciantesPage() {
  const articleLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: PAGE_TITLE,
    description: PAGE_DESC,
    datePublished: DATE,
    dateModified: DATE_MODIFIED,
    inLanguage: "pt-BR",
    articleSection: "Guias",
    keywords:
      "toca-discos para iniciantes, como escolher toca-discos, vitrola estraga disco, cápsula cerâmica, contrapeso, anti-skating, pré-amplificador phono",
    author: {
      "@type": "Person",
      "@id": `${SITE_URL}/sobre#person`,
      name: "Vinicius Stanula",
      url: `${SITE_URL}/sobre`,
      sameAs: ["https://linkedin.com/in/vinicius-stanula"],
    },
    publisher: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "Garimpa Vinil" },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/guias/${SLUG}` },
    image: { "@type": "ImageObject", url: HERO_IMAGE, width: 1200, height: 675 },
    speakable: { "@type": "SpeakableSpecification", cssSelector: ["h1"] },
  });

  const breadcrumbLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Guias", item: `${SITE_URL}/guias` },
      { "@type": "ListItem", position: 3, name: PAGE_TITLE, item: `${SITE_URL}/guias/${SLUG}` },
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
    <div className="vinil-sidebar-layout mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqLd }} />

      <nav aria-label="Navegação estrutural" className="mb-6 text-sm text-dust flex gap-2 flex-wrap">
        <Link href="/" className="hover:text-gold transition-colors">Início</Link>
        <span aria-hidden="true">›</span>
        <Link href="/guias" className="hover:text-gold transition-colors">Guias</Link>
        <span aria-hidden="true">›</span>
        <span className="text-parchment">Toca-Discos para Iniciantes</span>
      </nav>

      <header className="relative mb-8 overflow-hidden rounded-2xl bg-sleeve border border-groove px-6 py-7 vinyl-grooves">
        <span className="text-xs font-semibold border rounded-full px-2.5 py-0.5 text-deallit border-deal/30 bg-deal/10 mb-4 inline-block">
          Guia
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-black text-cream leading-tight mb-3 [text-wrap:balance]">
          Toca-Discos para Iniciantes:{" "}
          <span className="text-gold">Como Escolher</span>
        </h1>
        <p className="text-parchment text-sm max-w-2xl leading-relaxed">
          Vitrola de maleta ou toca-discos de verdade? O que a ficha técnica de cada um diz, o que
          ela esconde, e por que a peça mais barata do aparelho é a que decide o destino da sua
          coleção.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-dust">
          <span>
            Publicado em <time dateTime={DATE} className="text-parchment">10 de julho de 2026</time>
          </span>
          <span>
            Atualizado em <time dateTime={DATE_MODIFIED} className="text-parchment">10 de julho de 2026</time>
          </span>
          <span className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.25" />
              <path d="M6 3.5V6.5L7.5 8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            </svg>
            Leitura: ~9 min
          </span>
        </div>
      </header>

      <figure className="mb-8 rounded-2xl overflow-hidden">
        <Image
          src="/blog/toca-discos-capsula-agulha.jpg"
          alt="Cabeçote, cápsula e agulha de toca-discos em close sobre um disco de vinil, com os pontos estroboscópicos do prato ao fundo"
          width={1200}
          height={675}
          className="w-full object-cover max-h-96"
          priority
        />
      </figure>

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
            Você abre a Amazon, procura &quot;toca-discos&quot;, ordena por mais vendidos, e a primeira
            página inteira custa entre trezentos e setecentos reais. Vitrola retrô, Bluetooth, rádio
            FM, grava em USB, dois alto-falantes embutidos, acabamento marrom envelhecido. Do lado, um
            Audio-Technica custa mil e trezentos e não faz nada disso. Parece decisão fácil.
          </p>
          <p>Antes de decidir, leia a ficha técnica das duas.</p>
          <p>
            A da Raveo Sonetto, uma das vitrolas mais vendidas do país, lista: conectividade
            Bluetooth, entrada USB com função de gravação, rádio FM integrado, operação bivolt, design
            retrô com acabamento marrom, reprodução em 33, 45 e 78 rpm, saída auxiliar. Sete pontos.
            Nenhum deles é sobre a peça que encosta no disco.
          </p>
          <p>
            A do Audio-Technica AT-LP60X lista: acionamento por correia, prato de alumínio fundido
            antirressonância, cabeçote redesenhado para melhor rastreamento, cartucho dual magnet com
            ponta substituível, pré-amplificador phono selecionável. Cinco pontos. Quatro deles são
            sobre a peça que encosta no disco.
          </p>
          <p>Essa diferença não é acidente de redação. É onde está o dinheiro do produto.</p>
        </div>

        {/* 1 */}
        <section id="a-agulha">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            A Agulha Toca o Disco. O Bluetooth Não.
          </h2>
          <div className="space-y-4 text-parchment text-base leading-relaxed">
            <p>
              Um sulco de vinil é uma ranhura em PVC com paredes de alguns micrômetros. A agulha desce
              dentro dela e é arrastada. Tudo o que acontece de bom ou de ruim no seu disco acontece
              nesse contato, e o resto do aparelho existe para deixar esse contato o menos violento
              possível.
            </p>
            <p>
              Há dois tipos de cápsula no mercado de entrada. A cerâmica, também chamada de
              piezoelétrica, gera um sinal elétrico forte por deformação de um cristal. Sinal forte é
              conveniente: dispensa pré-amplificador, o que corta um componente inteiro do custo. Para
              arrancar esse sinal do cristal, a agulha precisa empurrar a parede do sulco com força. A
              magnética, do tipo dual magnet que a Audio-Technica usa até nos modelos mais baratos,
              gera um sinal fraco por indução, e por isso precisa de um pré-amplificador. Ela pisa mais
              leve.
            </p>
            <p>
              A ficha da Raveo não informa a força de rastreamento. Nem a das outras vitrolas que
              apareceram na busca. Não é omissão de espaço: elas listam a cor do acabamento.
            </p>
            <p>
              O desgaste do sulco é cumulativo e não volta. Uma cápsula pesada com ponta cônica não
              risca o disco na primeira execução; ela come a parede do sulco ao longo de dezenas de
              reproduções, tirando primeiro os agudos, depois a definição. Quando você percebe, o disco
              já perdeu. E o disco costuma custar mais caro que a diferença entre a vitrola e o
              toca-discos decente.
            </p>
          </div>
        </section>

        {/* 2 */}
        <section id="contrapeso">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Contrapeso, Anti-Skating, e Por Que Eles Somem nos Aparelhos Baratos
          </h2>
          <div className="space-y-4 text-parchment text-base leading-relaxed">
            <p>
              O braço tem que aplicar uma força vertical específica sobre o sulco, medida em gramas.
              Pouca força, a agulha pula. Força demais, ela desgasta. O contrapeso é o cilindro na
              traseira do braço que ajusta esse número.
            </p>
            <p>
              O anti-skating resolve outro problema. O braço gira em arco e o atrito do sulco puxa a
              agulha para dentro, contra a parede interna. Sem compensação, um lado do sulco apanha
              mais que o outro.
            </p>
            <p>
              Nenhuma vitrola de maleta tem os dois. O AT-LP60X também não tem: ele é totalmente
              automático e a força vem calibrada de fábrica, o que é uma escolha de projeto honesta
              para quem não quer regular nada. A diferença é que a fábrica calibrou para uma cápsula
              magnética leve.
            </p>
            <p>
              Quando você sobe para o AT-LP120XUSB, a ficha muda de vocabulário: braço em S balanceado
              com elevação amortecida hidraulicamente, cabeçote universal AT-HS6, cápsula AT-VM95E com
              agulha elíptica. Braço balanceado significa contrapeso. Cabeçote universal significa que
              você troca a cápsula por qualquer outra do padrão. Agulha elíptica significa que a ponta
              acompanha a modulação do sulco com mais precisão que a cônica.
            </p>
          </div>
        </section>

        {/* 3 */}
        <section id="tracao">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Correia ou Tração Direta
          </h2>
          <div className="space-y-4 text-parchment text-base leading-relaxed">
            <p>
              A correia isola o motor do prato com um elástico de borracha, o que reduz a vibração do
              motor que chega à agulha. É o arranjo da maioria dos toca-discos de escuta doméstica, e é
              o do AT-LP60X e o do JBL Spinner BT.
            </p>
            <p>
              A tração direta acopla o motor ao prato. Ela chega à rotação certa em menos de uma volta
              e mantém a velocidade sob torque, que é o motivo de DJ usar tração direta há cinquenta
              anos. O AT-LP120XUSB é direta, com trava de velocidade de quartzo e bandeja
              estroboscópica para conferir a rotação.
            </p>
            <p>
              Para ouvir disco em casa, correia dá conta. A escolha só vira relevante se você for mexer
              no disco com a mão ou se a estabilidade de rotação te incomodar de verdade.
            </p>
          </div>
        </section>

        {/* 4 */}
        <section id="pre-phono">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Pré-Amplificador Phono: Você Precisa de Um?
          </h2>
          <div className="space-y-4 text-parchment text-base leading-relaxed">
            <p>
              Cápsula magnética entrega um sinal fraco e com a curva de equalização RIAA aplicada na
              gravação. O pré-phono amplifica e desfaz essa curva. Sem ele, o som sai baixo e sem grave.
            </p>
            <p>
              Três caminhos existem. O toca-discos traz o pré embutido e selecionável, como o AT-LP60X e
              o AT-LP120XUSB, e aí você liga em qualquer entrada auxiliar. Seu amplificador tem entrada
              PHONO, e aí você usa a dele. Ou você compra um pré externo.
            </p>
            <p>
              As vitrolas com cápsula cerâmica não precisam de nada disso, porque o sinal já sai forte.
              É a conveniência que você paga com o sulco.
            </p>
            <p>
              O assunto tem detalhe que não cabe aqui: como identificar se o seu sistema já tem um pré,
              o erro comum de ligar dois em série e o ganho que a cápsula exige. Está tudo no{" "}
              <Link href="/guias/pre-amplificador-phono" className="text-gold hover:underline">
                guia sobre pré-amplificador phono
              </Link>
              .
            </p>
          </div>
        </section>

        {/* 5 */}
        <section id="aparelhos">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Os Aparelhos
          </h2>
          <div className="space-y-4">
            {APARELHOS.map(({ asin, nome, img, desc }) => (
              <div key={asin} className="bg-sleeve border border-groove rounded-xl p-4 flex gap-4 items-start">
                <Image
                  src={img}
                  alt={`${nome} — foto do produto na Amazon`}
                  width={96}
                  height={96}
                  className="rounded-lg bg-cream/5 object-contain shrink-0 w-20 h-20 sm:w-24 sm:h-24"
                />
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-cream mb-1">{nome}</p>
                  <p className="text-parchment text-sm leading-relaxed mb-3">{desc}</p>
                  <a
                    href={`https://www.amazon.com.br/dp/${asin}?tag=${AFFILIATE_TAG}`}
                    target="_blank"
                    rel="sponsored nofollow noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-gold/10 border border-gold/30 text-gold text-xs font-semibold px-4 py-2 rounded-full hover:bg-gold/20 transition-colors"
                  >
                    Ver na Amazon
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </div>
              </div>
            ))}
          </div>
          <p className="text-dust text-xs leading-relaxed mt-4">
            Links de afiliado da Amazon <span className="text-parchment">#anúncio</span>. Preço a gente
            não publica aqui porque preço muda; confira na página do produto.
          </p>
        </section>

        {/* 6 */}
        <section id="quando-vitrola">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Quando a Vitrola Faz Sentido
          </h2>
          <div className="space-y-4 text-parchment text-base leading-relaxed">
            <p>
              Ela faz sentido quando o disco não importa. Decoração de estante, um sábado tocando um LP
              herdado que você não pretende preservar, uma criança aprendendo o que é um sulco. São usos
              legítimos e ninguém precisa de permissão para eles.
            </p>
            <p>
              Ela deixa de fazer sentido no instante em que você começa a comprar disco com intenção.
              Dos vinte e seis mil vinis que a gente monitora na Amazon Brasil, a mediana de preço está
              em duzentos e noventa reais, e só catorze por cento saem por menos de duzentos. Dois discos
              e você já gastou o preço de uma vitrola de maleta. Ela vai continuar comendo esses dois
              discos, e todos os próximos.
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
        </section>

        {/* FAQ */}
        <section id="faq">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Perguntas Frequentes Sobre Toca-Discos
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

        {/* Related guides */}
        <section aria-label="Guias relacionados">
          <h2 className="font-display text-lg font-bold text-cream mb-4">Leia também</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              {
                href: "/guias/como-cuidar-de-discos-de-vinil",
                title: "Como Cuidar de Discos de Vinil",
                desc: "Limpeza, armazenamento no clima do Brasil e os cinco erros que destroem coleções.",
              },
              {
                href: "/guias/vinil-180g-vale-a-pena",
                title: "Vinil 180g Vale a Pena ou É Só Marketing?",
                desc: "O peso do disco muda o som? E o que o VTA do seu braço tem a ver com isso.",
              },
            ].map(({ href, title, desc }) => (
              <Link key={href} href={href} className="block bg-sleeve border border-groove rounded-xl p-4 hover:border-patina transition-colors">
                <p className="font-display text-sm font-bold text-cream mb-1">{title}</p>
                <p className="text-parchment text-xs leading-relaxed">{desc}</p>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
