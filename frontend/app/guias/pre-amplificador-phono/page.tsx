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

const SLUG = "pre-amplificador-phono";
const PAGE_TITLE = "Pré-Amplificador Phono: Você Precisa de Um?";
const PAGE_DESC =
  "Som fino, baixo e sem grave ao ligar o toca-discos? Falta um pré-phono. O que ele faz, como saber se você já tem, o erro dos dois prés e os modelos na Amazon Brasil.";
const DATE = "2026-07-10";
const DATE_MODIFIED = "2026-07-10";
const HERO_IMAGE = `${SITE_URL}/blog/pre-amplificador-phono-hifi.jpg`;
const AFFILIATE_TAG = "garimpa-vinil-20";

export const metadata: Metadata = {
  title: "Pré-Amplificador Phono: Você Precisa de Um? | Garimpa Vinil",
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
        alt: "Pré-amplificador estéreo vintage com fileiras de knobs de graves, agudos e volume, sobre estante de madeira",
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
  { id: "o-que-faz", label: "O que o pré-phono faz" },
  { id: "ja-tenho", label: "Como saber se você já tem um" },
  { id: "dois-pres", label: "O erro dos dois prés" },
  { id: "mm-mc", label: "MM, MC e o número que importa" },
  { id: "vale-trocar", label: "Trocar o pré embutido por um externo compensa?" },
  { id: "aparelhos", label: "Os aparelhos" },
  { id: "faq", label: "Perguntas frequentes" },
];

const APARELHOS = [
  {
    asin: "B08TLRPMDC",
    nome: "Fosi Audio Box X1",
    img: "https://m.media-amazon.com/images/I/31jYgmgq0WL._SL500_.jpg",
    desc: "Pré-phono MM, converte o sinal phono em nível de linha, entrada de toca-discos MM e saída RCA, fonte externa de 12V. É o caminho mais curto entre um toca-discos sem pré e uma entrada auxiliar.",
  },
  {
    asin: "B000H2BC4E",
    nome: "Behringer PP400",
    img: "https://m.media-amazon.com/images/I/41kqFc9zhvL._SL500_.jpg",
    desc: "Entradas e saídas RCA estéreo, mais uma saída de 6,3 mm. Compacto e sem firula. Está no mercado há tanto tempo que virou referência de piso.",
  },
  {
    asin: "B0F9DVJQ9B",
    nome: "S.M.S.L PH-1",
    img: "https://m.media-amazon.com/images/I/21IItrf0C-L._SL500_.jpg",
    desc: "MM com ganho declarado de 46 dB, THD+N de −81 dB e separação de canais de −77 dB. Corpo usinado em CNC, do tamanho da palma da mão. É o degrau para quem já trocou a cápsula e quer o número na ficha.",
  },
  {
    asin: "B002GHBYZ0",
    nome: "Behringer U-PHONO UFO202",
    img: "https://m.media-amazon.com/images/I/41GM4MelaCL._SL500_.jpg",
    desc: "Pré-phono com interface de áudio USB. Serve para quem quer ouvir e também passar o disco para o computador sem comprar dois aparelhos.",
  },
];

const FAQ = [
  {
    q: "Posso ligar o toca-discos direto na caixa Bluetooth?",
    a: "Se o toca-discos tem pré-phono embutido e a chave está em LINE, sim. Se não tem, o som vai sair baixo e sem grave, e nenhum ajuste de volume conserta, porque o que falta é a curva RIAA, não o volume. Nesse caso você precisa de um pré-phono entre o toca-discos e a caixa.",
  },
  {
    q: "Pré-phono melhora o som de vitrola de maleta?",
    a: "Não. A cápsula cerâmica dessas vitrolas já entrega um sinal forte e com a equalização resolvida de fábrica. Ligar um pré-phono na saída dela só piora, porque a curva RIAA acaba aplicada duas vezes, deixando o som abafado e desequilibrado.",
  },
  {
    q: "Qual ganho eu preciso?",
    a: "Para cápsula de ímã móvel (MM), que é o caso de praticamente qualquer toca-discos de entrada, algo em torno de 40 dB dá conta. O S.M.S.L PH-1, por exemplo, declara 46 dB, o que é folgado. Cápsula de bobina móvel (MC) exige bem mais ganho, mas isso é conversa de quem já investiu numa cápsula cara, não de quem está começando.",
  },
  {
    q: "O parafuso de aterramento é obrigatório?",
    a: "Quando existe, use. Ele elimina o zumbido de 60 Hz que aparece quando o chassi do toca-discos não compartilha referência de terra com o amplificador. Se o seu toca-discos não tem fio terra e o som não zumbe, não há o que resolver.",
  },
  {
    q: "O pré embutido do AT-LP60X é ruim?",
    a: "Ele é modesto e resolve. Trocá-lo por um pré externo de faixa de preço parecida muda pouco no som. O dinheiro rende mais numa agulha nova quando a atual se desgasta e em caixas melhores, que fazem diferença bem mais audível que o estágio de ganho.",
  },
];

export default function PrePhonoPage() {
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
      "pré-amplificador phono, pré-phono, phono preamp, curva RIAA, cápsula MM, cápsula MC, entrada phono, ganho phono",
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
        <span className="text-parchment">Pré-Amplificador Phono</span>
      </nav>

      <header className="relative mb-8 overflow-hidden rounded-2xl bg-sleeve border border-groove px-6 py-7 vinyl-grooves">
        <span className="text-xs font-semibold border rounded-full px-2.5 py-0.5 text-deallit border-deal/30 bg-deal/10 mb-4 inline-block">
          Guia
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-black text-cream leading-tight mb-3 [text-wrap:balance]">
          Pré-Amplificador Phono:{" "}
          <span className="text-gold">Você Precisa de Um?</span>
        </h1>
        <p className="text-parchment text-sm max-w-2xl leading-relaxed">
          Ligou o toca-discos e o som saiu fino, baixo, sem grave? Não é defeito do aparelho nem do
          disco. Falta um pré-phono no caminho — e talvez o seu já tenha um escondido.
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
            Leitura: ~8 min
          </span>
        </div>
      </header>

      <figure className="mb-8 rounded-2xl overflow-hidden">
        <Image
          src="/blog/pre-amplificador-phono-hifi.jpg"
          alt="Pré-amplificador estéreo vintage com fileiras de knobs de graves, agudos e volume, sobre estante de madeira"
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
            Você ligou o toca-discos na entrada auxiliar do receiver, na soundbar ou na caixa
            Bluetooth, subiu o volume até o fim e o som saiu fino, baixo, sem grave nenhum. Parece
            defeito do aparelho, do cabo ou do disco. Não é nenhum dos três.
          </p>
          <p>
            O sinal que sai de uma cápsula magnética é fraco e está deliberadamente distorcido. Falta
            um aparelho no meio do caminho para consertar as duas coisas, e o nome dele é
            pré-amplificador phono.
          </p>
        </div>

        {/* 1 */}
        <section id="o-que-faz">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            O que o Pré-Phono Faz
          </h2>
          <div className="space-y-4 text-parchment text-base leading-relaxed">
            <p>
              Quando uma matriz de vinil é cortada, o engenheiro não grava o som como ele é. Ele reduz
              o grave e levanta o agudo, seguindo uma curva padronizada desde 1954 pela Recording
              Industry Association of America, a curva RIAA.
            </p>
            <p>
              Há um motivo físico para isso. Grave tem excursão grande: gravado no nível real, o sulco
              ficaria tão largo que caberiam poucos minutos por lado, e a agulha saltaria para a faixa
              vizinha. Agudo tem amplitude pequena e some no ruído de superfície do PVC. Cortar o grave
              e levantar o agudo resolve os dois problemas de uma vez.
            </p>
            <p>
              O disco que está na sua mão, portanto, guarda uma versão torta da música. O pré-phono faz
              duas coisas ao mesmo tempo: aplica a curva inversa, devolvendo o grave e baixando o agudo
              ao lugar, e amplifica o sinal da cápsula até o nível de linha, que é o que qualquer
              entrada auxiliar espera receber.
            </p>
            <p>
              Sem ele, você ouve exatamente o que o disco guarda: pouco volume, agudo estridente e grave
              que sumiu.
            </p>
          </div>
        </section>

        {/* 2 */}
        <section id="ja-tenho">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Como Saber se Você Já Tem Um
          </h2>
          <div className="space-y-4 text-parchment text-base leading-relaxed">
            <p>Ele pode estar em três lugares, e vale conferir na ordem.</p>
            <p>
              No próprio toca-discos. Modelos como o AT-LP60X e o AT-LP120XUSB trazem um pré embutido
              com chave selecionável, geralmente marcada LINE e PHONO. Em LINE, o pré interno está
              ligado e você pode plugar em qualquer entrada auxiliar. Em PHONO, ele está desligado e o
              sinal sai cru.
            </p>
            <p>
              No amplificador ou receiver. Procure uma entrada RCA rotulada PHONO, quase sempre
              acompanhada de um parafuso de aterramento (GND). Equipamento antigo costuma ter; soundbar
              e caixa Bluetooth, nunca.
            </p>
            <p>
              Em nenhum dos dois. Aí você precisa de um pré externo, e é para isso que existe a lista
              mais abaixo.
            </p>
            <p>
              Vitrolas com cápsula cerâmica não entram nessa conta. O cristal piezoelétrico entrega um
              sinal na casa das centenas de milivolts, dezenas de vezes mais forte que o de uma
              magnética, e a resposta dele já sai perto do que a curva RIAA pediria, de um jeito tosco.
              É o motivo de a vitrola tocar direto na caixinha, e é o mesmo motivo de ela pesar a mão no
              sulco.
            </p>
          </div>
        </section>

        {/* 3 */}
        <section id="dois-pres">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            O Erro dos Dois Prés
          </h2>
          <div className="space-y-4 text-parchment text-base leading-relaxed">
            <p>
              Dois prés em série é o engano mais comum de quem acabou de montar o sistema, e ele tem
              sintoma próprio.
            </p>
            <p>
              Se o toca-discos está em LINE e você plugou na entrada PHONO do amplificador, o sinal
              passa por duas equalizações e dois ganhos. O som sai alto demais, comprimido, com grave
              inchado e agudo áspero. Você vai achar que o disco está estourado.
            </p>
            <p>
              Se o toca-discos está em PHONO e você plugou na entrada auxiliar, acontece o oposto:
              volume baixo, som fino, grave ausente.
            </p>
            <p>
              O diagnóstico é direto. Baixo e sem grave: falta pré. Alto e distorcido: sobra pré. Um
              pré, e só um, entre a cápsula e o amplificador.
            </p>
          </div>
        </section>

        {/* 4 */}
        <section id="mm-mc">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            MM, MC e o Número que Importa
          </h2>
          <div className="space-y-4 text-parchment text-base leading-relaxed">
            <p>
              Cápsula magnética vem em dois tipos. A de ímã móvel, MM, entrega algo em torno de cinco
              milivolts e é o que praticamente todo toca-discos de entrada usa. A AT3600L do AT-LP60X e
              a AT-VM95E do AT-LP120XUSB são MM.
            </p>
            <p>
              A de bobina móvel, MC, entrega perto de meio milivolt. Dez vezes menos sinal exige bem
              mais ganho, e um pré de MM não dá conta de uma MC.
            </p>
            <p>
              Por isso a ficha de um pré informa o ganho em decibéis. O S.M.S.L PH-1, por exemplo,
              declara 46 dB, o que é folgado para qualquer MM. Se você tem um toca-discos de entrada, é
              MM, e qualquer pré de MM resolve. A conversa sobre MC começa depois, com cápsulas que
              custam mais que o toca-discos inteiro.
            </p>
          </div>
        </section>

        {/* 5 */}
        <section id="vale-trocar">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Trocar o Pré Embutido por um Externo Compensa?
          </h2>
          <div className="space-y-4 text-parchment text-base leading-relaxed">
            <p>
              Na maioria dos casos, não. O pré embutido de um AT-LP60X é o elo mais barato da corrente,
              e é tentador atacá-lo primeiro. Ele não costuma ser o gargalo.
            </p>
            <p>
              Antes dele estão a agulha, que se desgasta e machuca o sulco quando passa da hora, e o
              alinhamento da cápsula. Depois dele estão as caixas e a sala, que fazem mais diferença
              audível que qualquer estágio de ganho decente. Um pré externo de duzentos e cinquenta
              reais no lugar de um embutido razoável muda pouco.
            </p>
            <p>
              O pré externo faz sentido em duas situações concretas. Quando não existe pré nenhum no
              caminho, que é a maioria dos casos de quem liga em soundbar. E quando você troca a cápsula
              por uma melhor e o pré embutido não tem como acompanhar, o que só acontece depois que o
              resto já está resolvido.
            </p>
          </div>
        </section>

        {/* 6 */}
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

        {/* FAQ */}
        <section id="faq">
          <h2 className="font-display text-2xl font-black text-cream mb-5 [text-wrap:balance]">
            Perguntas Frequentes Sobre Pré-Phono
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
                href: "/guias/toca-discos-para-iniciantes",
                title: "Toca-Discos para Iniciantes: Como Escolher",
                desc: "Vitrola ou toca-discos de verdade? Cápsula, contrapeso e por que a peça mais barata decide tudo.",
              },
              {
                href: "/guias/como-cuidar-de-discos-de-vinil",
                title: "Como Cuidar de Discos de Vinil",
                desc: "Limpeza, armazenamento no clima do Brasil e os cinco erros que destroem coleções.",
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
