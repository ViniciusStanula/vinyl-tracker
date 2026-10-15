import { queryBlackFridayWithCache } from "@/lib/db/blackFriday";
import { bfSeason, diaMes } from "@/lib/blackFriday";
import BlackFridayRecords from "@/components/BlackFridayRecords";
import Link from "next/link";
import type { Metadata } from "next";
import { toJsonLd, discoListItems } from "@/lib/jsonld";
import { SITE_URL } from "@/lib/siteUrl";

export const revalidate = 14400;

// One URL every year, so links and rankings carry over between editions. The
// phase (warm-up / Black Friday week / after) is derived from the date at
// render; it only changes on day boundaries, so it adds no ISR churn.
// No countdown for the same reason: it would change the HTML every day.

export async function generateMetadata(): Promise<Metadata> {
  const { year, baselineStart, baselineEnd } = bfSeason();
  const title = `Black Friday ${year} de Discos de Vinil | Garimpa Vinil`;
  const description = `Discos de vinil em oferta na Black Friday ${year}, com o desconto medido contra o que cada disco custou entre ${diaMes(baselineStart)} e ${diaMes(baselineEnd)}. Sem metade do dobro.`;
  return {
    title,
    description,
    alternates: { canonical: "/black-friday" },
    openGraph: { title, description, url: "/black-friday", type: "website", images: ["/og-default.png"] },
  };
}

export default async function BlackFridayPage() {
  const season = bfSeason();
  const { year, phase, blackFriday, weekStart, cyberMonday, baselineStart, baselineEnd } = season;
  const janela = `entre ${diaMes(baselineStart)} e ${diaMes(baselineEnd)}`;
  const items = phase === "depois" ? [] : await queryBlackFridayWithCache(year);

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: `Black Friday ${year}`, item: `${SITE_URL}/black-friday` },
    ],
  });
  const itemListJsonLd = items.length > 0 && toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Black Friday ${year} de Discos de Vinil`,
    url: `${SITE_URL}/black-friday`,
    numberOfItems: items.length,
    itemListElement: discoListItems(items, SITE_URL),
  });

  const eyebrow = {
    antes: `${diaMes(blackFriday)} · semana de ${diaMes(weekStart)} a ${diaMes(cyberMonday)}`,
    agora: `Acontecendo agora · até ${diaMes(cyberMonday)}`,
    depois: "Edição encerrada",
  }[phase];

  const intro = {
    antes: `Desde ${diaMes(baselineStart)} anotamos o preço de cada disco, para conferir os descontos quando a Black Friday chegar. Estes já custam menos do que vinham custando.`,
    agora: `Discos que custam pelo menos 10% menos do que custavam ${janela}.`,
    depois: "Esta página volta em setembro, quando recomeçamos a anotar os preços.",
  }[phase];

  const faq: [string, string][] = [
    [
      `Quando é a Black Friday ${year}?`,
      `Sexta-feira, ${diaMes(blackFriday)}. A Cyber Monday vem na segunda seguinte, ${diaMes(cyberMonday)}.`,
    ],
    [
      "Como saber se o desconto é real?",
      `Compare com o preço de antes da campanha, não com o "de" que a loja mostra. O truque mais comum tem até nome, metade do dobro: a loja dobra o preço semanas antes e anuncia 50% de desconto, e o disco sai pelo preço de sempre. Aqui o preço riscado é a mediana ${janela}.`,
    ],
    [
      "A Amazon começa a Black Friday antes da sexta-feira?",
      "Começa. Em 2025, o esquenta da Amazon abriu semanas antes da data. Por isso esta página mostra a lista da Black Friday desde 1º de novembro, e a referência de preço fecha antes disso.",
    ],
    [
      "Como sei quando um disco baixar de preço?",
      "Na página de cada disco há um alerta de preço: você escolhe quanto quer pagar, deixa o e-mail e avisamos quando o preço chegar lá.",
    ],
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      {itemListJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJsonLd }} />
      )}
      <Link href="/" className="text-parchment hover:text-gold text-sm transition-colors mb-6 inline-block">
        ← Início
      </Link>

      <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end lg:gap-12">
        <header>
          <span className="font-mono text-gold text-[11px] font-medium uppercase tracking-[0.18em] block mb-3">
            {eyebrow}
          </span>
          <h1 className="font-display text-3xl sm:text-5xl font-black text-cream leading-[0.95] [text-wrap:balance]">
            Black Friday {year} de discos de vinil
          </h1>
          <p className="mt-4 text-parchment text-sm sm:text-base max-w-xl leading-relaxed">{intro}</p>
          {items.length > 0 && (
            <p className="mt-4 font-mono text-cream text-xs tabular-nums">
              Os <span className="text-gold font-bold">{items.length}</span> maiores descontos sobre o preço de referência
            </p>
          )}
        </header>

        <section aria-labelledby="como-medimos" className="rounded-xl border border-groove bg-sleeve p-5">
          <h2 id="como-medimos" className="font-display text-base font-bold text-cream">
            Como medimos o desconto
          </h2>
          <p className="mt-3 text-parchment text-sm leading-relaxed">
            O preço riscado em cada disco é a mediana do que ele custou {janela}, antes de qualquer
            campanha. Só entra na lista quem está pelo menos 10% abaixo disso.
          </p>
          <p className="mt-2 text-parchment text-sm leading-relaxed">
            Assim a metade do dobro não passa: se a loja sobe o preço em novembro para anunciar o
            corte, a referência continua a mesma.
          </p>
          {phase === "antes" && (
            <p className="mt-4 pt-3 border-t border-groove text-dust text-xs leading-snug">
              Se você espera um disco específico, crie um alerta na página dele: mandamos um e-mail quando o preço cair.
            </p>
          )}
        </section>
      </div>

      {items.length > 0 ? (
        <BlackFridayRecords items={items} />
      ) : (
        <p className="text-parchment text-sm">
          {phase === "depois"
            ? "Enquanto isso, as ofertas do dia continuam em "
            : "Nenhum disco abaixo do preço de referência agora. Veja as ofertas do dia em "}
          <Link href="/ofertas" className="text-gold hover:underline">/ofertas</Link>.
        </p>
      )}

      <section aria-labelledby="perguntas" className="mt-14 max-w-3xl">
        <h2 id="perguntas" className="font-display text-2xl font-black text-cream">
          Perguntas sobre a Black Friday {year}
        </h2>
        <div className="mt-4 divide-y divide-groove border-y border-groove">
          {faq.map(([pergunta, resposta]) => (
            <details key={pergunta} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-cream hover:text-gold transition-colors [&::-webkit-details-marker]:hidden">
                {pergunta}
                <span aria-hidden="true" className="text-gold transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-parchment text-sm leading-relaxed">{resposta}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
