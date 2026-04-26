import BackToTop from "@/components/BackToTop";
import GraficoPreco from "@/components/GraficoPreco";
import Link from "next/link";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vinyl-tracker.vercel.app";

const breadcrumbJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Sobre", item: `${SITE_URL}/sobre` },
  ],
});

const EXEMPLO_PRECOS = [
  { data: "21/03", dataFull: "21/03/2026", valor: 199.90 },
  { data: "22/03", dataFull: "22/03/2026", valor: 199.90 },
  { data: "23/03", dataFull: "23/03/2026", valor: 214.90 },
  { data: "24/03", dataFull: "24/03/2026", valor: 214.90 },
  { data: "25/03", dataFull: "25/03/2026", valor: 219.90 },
  { data: "26/03", dataFull: "26/03/2026", valor: 219.90 },
  { data: "27/03", dataFull: "27/03/2026", valor: 219.90 },
  { data: "28/03", dataFull: "28/03/2026", valor: 204.90 },
  { data: "29/03", dataFull: "29/03/2026", valor: 204.90 },
  { data: "30/03", dataFull: "30/03/2026", valor: 199.90 },
  { data: "31/03", dataFull: "31/03/2026", valor: 199.90 },
  { data: "01/04", dataFull: "01/04/2026", valor: 209.90 },
  { data: "02/04", dataFull: "02/04/2026", valor: 209.90 },
  { data: "03/04", dataFull: "03/04/2026", valor: 209.90 },
  { data: "04/04", dataFull: "04/04/2026", valor: 199.90 },
  { data: "05/04", dataFull: "05/04/2026", valor: 194.90 },
  { data: "06/04", dataFull: "06/04/2026", valor: 194.90 },
  { data: "07/04", dataFull: "07/04/2026", valor: 189.90 },
  { data: "08/04", dataFull: "08/04/2026", valor: 189.90 },
  { data: "09/04", dataFull: "09/04/2026", valor: 189.90 },
  { data: "10/04", dataFull: "10/04/2026", valor: 179.90 },
  { data: "11/04", dataFull: "11/04/2026", valor: 179.90 },
  { data: "12/04", dataFull: "12/04/2026", valor: 184.90 },
  { data: "13/04", dataFull: "13/04/2026", valor: 184.90 },
  { data: "14/04", dataFull: "14/04/2026", valor: 169.90 },
  { data: "15/04", dataFull: "15/04/2026", valor: 169.90 },
  { data: "16/04", dataFull: "16/04/2026", valor: 169.90 },
  { data: "17/04", dataFull: "17/04/2026", valor: 154.90 },
  { data: "18/04", dataFull: "18/04/2026", valor: 154.90 },
  { data: "19/04", dataFull: "19/04/2026", valor: 149.90 },
];

export const metadata = {
  title: "Sobre — Garimpa Vinil",
  description:
    "Como o Garimpa Vinil funciona: monitoramento de preços de discos de vinil na Amazon Brasil, histórico e detecção automática de ofertas.",
  alternates: { canonical: "/sobre" },
  openGraph: {
    title: "Sobre — Garimpa Vinil",
    description:
      "Como o Garimpa Vinil funciona: monitoramento de preços de discos de vinil na Amazon Brasil, histórico e detecção automática de ofertas.",
    url: "/sobre",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Sobre — Garimpa Vinil",
    description:
      "Como o Garimpa Vinil funciona: monitoramento de preços de discos de vinil na Amazon Brasil, histórico e detecção automática de ofertas.",
  },
};

export default function SobrePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

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
          Um rastreador de preços de discos de vinil na Amazon Brasil. Monitora
          centenas de títulos de hora em hora, guarda o histórico completo e avisa
          quando o preço cai de verdade — não só quando a Amazon coloca um banner
          vermelho.
        </p>
      </header>

      {/* ── O que o site faz ────────────────────────────────────── */}
      <section className="mb-6 bg-sleeve border border-groove rounded-xl p-6">
        <h2 className="font-display text-xl font-bold text-cream mb-3">
          O que acontece nos bastidores
        </h2>
        <p className="text-parchment text-sm leading-relaxed mb-3">
          A cada hora, um crawler percorre as páginas de produto na Amazon Brasil e
          registra o preço atual de cada disco rastreado. Esse valor vai para um
          banco de dados junto com a data e hora exatas da captura.
        </p>
        <p className="text-parchment text-sm leading-relaxed mb-3">
          Com esse histórico, dá pra calcular médias e mínimos reais — não estimativas,
          mas valores baseados nos preços que o site registrou ao longo do tempo. É com
          esse histórico que as ofertas são detectadas.
        </p>
        <p className="text-parchment text-sm leading-relaxed">
          O histórico completo fica visível no gráfico de cada disco, com anotação do
          preço mínimo e máximo registrados. Assim você vê se aquele "desconto" é real
          ou se o preço sempre ficou ali.
        </p>
      </section>

      {/* ── Como funciona ───────────────────────────────────────── */}
      <section className="mb-6 bg-sleeve border border-groove rounded-xl p-6">
        <h2 className="font-display text-xl font-bold text-cream mb-3">
          Como funciona a detecção de ofertas
        </h2>
        <p className="text-parchment text-sm leading-relaxed mb-4">
          Não basta o preço estar baixo — ele precisa ser baixo <em>em relação ao
          histórico daquele disco específico</em>. Um vinil que sempre custou R$150
          por R$130 pode ser uma boa oferta. O mesmo desconto num disco que flutua
          entre R$90 e R$200 não significa nada.
        </p>
        <p className="text-parchment text-sm leading-relaxed mb-5">
          Para um disco aparecer como oferta, duas condições precisam ser verdadeiras
          ao mesmo tempo: o preço atual precisa estar pelo menos{" "}
          <span className="text-cream font-medium">10% abaixo da média dos últimos
          30 dias</span> e a queda em reais precisa ser de{" "}
          <span className="text-cream font-medium">pelo menos R$2</span>. Isso evita
          que variações mínimas de centavos disparem alertas falsos.
        </p>

        <div className="flex flex-col gap-3">
          {/* Tier 1 */}
          <div className="flex gap-3 items-start rounded-lg border border-groove bg-label p-4">
            <span className="mt-0.5 shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-deal/20 text-deallit border border-deal/30">
              Boa Oferta
            </span>
            <p className="text-parchment text-sm leading-relaxed">
              Preço pelo menos 10% abaixo da média dos últimos 30 dias e queda de
              no mínimo R$2. A condição base — confirma que há um desconto real em
              relação ao comportamento recente do preço.
            </p>
          </div>

          {/* Tier 2 */}
          <div className="flex gap-3 items-start rounded-lg border border-groove bg-label p-4">
            <span className="mt-0.5 shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-deal/30 text-deallit border border-deal/40">
              Ótima Oferta
            </span>
            <p className="text-parchment text-sm leading-relaxed">
              Além de ser uma Boa Oferta, o preço atual também está abaixo da média
              dos <span className="text-cream font-medium">últimos 90 dias</span>.
              Esse segundo filtro só é aplicado quando o disco tem histórico
              suficiente — pelo menos 30 registros e 45 dias de dados — então quando
              aparece, é sinal mais confiável.
            </p>
          </div>

          {/* Tier 3 */}
          <div className="flex gap-3 items-start rounded-lg border border-groove bg-label p-4">
            <span className="mt-0.5 shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gold/20 text-gold border border-gold/30">
              Melhor Preço
            </span>
            <p className="text-parchment text-sm leading-relaxed">
              O preço atual está igual ou muito próximo (margem de 2%) do{" "}
              <span className="text-cream font-medium">menor preço dos últimos
              30 dias</span>. Quando isso acontece, o disco está na faixa mais baixa
              do período recente — independente da média. É o badge mais forte.
            </p>
          </div>
        </div>

        <p className="mt-4 text-dust text-xs leading-relaxed">
          Discos com pouco histórico recebem badges mais conservadores ou nenhum —
          o sistema prefere não sinalizar do que sinalizar errado.
        </p>
      </section>

      {/* ── Gráfico de preços ───────────────────────────────────── */}
      <section className="mb-6 bg-sleeve border border-groove rounded-xl p-6">
        <h2 className="font-display text-xl font-bold text-cream mb-3">
          O gráfico de preços
        </h2>
        <p className="text-parchment text-sm leading-relaxed mb-5">
          Cada página de disco tem um gráfico com a evolução do preço ao longo do
          tempo. Passe o mouse para ver o valor exato em cada data. Os pontos verde
          e vermelho marcam o mínimo e máximo registrados no período.
        </p>

        {/* Placeholder para gráfico exemplo */}
        <div className="rounded-xl border border-groove bg-label px-4 pt-4 pb-2">
          <GraficoPreco precos={EXEMPLO_PRECOS} />
        </div>
        <p className="mt-2 text-center text-dust text-xs">
          Exemplo: variação de preço de um disco nos últimos 30 dias
        </p>
      </section>

      <BackToTop />
    </main>
  );
}
