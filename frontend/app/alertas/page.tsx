import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import AlertasForm from "./AlertasForm";
import { getDiscoCount } from "@/lib/db/home";
import { toJsonLd } from "@/lib/jsonld";
import { SITE_URL } from "@/lib/siteUrl";

const TITLE = "Alerta de Preço de Vinil | Garimpa Vinil";
const DESCRIPTION =
  "Receba um e-mail quando o preço de um disco de vinil cair na Amazon. " +
  "Escolha o disco, defina seu preço limite e a gente avisa. Grátis, sem criar conta.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/alertas" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/alertas",
    type: "website",
    images: ["/og-default.png"],
  },
};

const STEPS = [
  {
    n: "1",
    t: "Escolha o disco",
    d: "Busque pelo título ou pelo artista. O alerta vale para aquele disco específico, não para o artista inteiro.",
  },
  {
    n: "2",
    t: "Defina o preço limite",
    d: "O valor a partir do qual você quer ser avisado. Vale a pena olhar o histórico do disco antes de escolher — o gráfico de 12 meses mostra quanto ele costuma custar.",
  },
  {
    n: "3",
    t: "Confirme seu e-mail",
    d: "Enviamos um link de confirmação. O alerta só passa a valer depois que você clica nele.",
  },
  {
    n: "4",
    t: "Receba o aviso",
    d: "Quando o preço registrado cair para o seu limite ou menos, o e-mail sai com o preço novo e o link do disco.",
  },
];

// Answers describe the behaviour actually implemented in
// database.check_alert_crossings() and alerts_cleanup.py — keep them in sync
// if the dispatch rules change.
const FAQ = [
  {
    q: "O alerta de preço é gratuito?",
    a: "Sim. Criar e manter alertas de preço no Garimpa Vinil é gratuito, e não há limite de alertas por pessoa.",
  },
  {
    q: "Preciso criar uma conta?",
    a: "Não. Você informa apenas o e-mail que vai receber o aviso e confirma pelo link que enviamos. Não há cadastro, senha nem perfil.",
  },
  {
    q: "Vou receber o mesmo aviso várias vezes?",
    a: "Não. O alerta dispara quando o preço cruza o seu limite de cima para baixo. Enquanto ele continuar abaixo do valor, você não recebe novos e-mails — o alerta volta a ficar armado se o preço subir acima do limite outra vez.",
  },
  {
    q: "Como cancelo um alerta?",
    a: "Todo e-mail que enviamos traz um link de gerenciamento. Por ele você vê o alerta e pode apagá-lo na hora. Alertas que nunca foram confirmados são apagados sozinhos depois de 7 dias.",
  },
  {
    q: "O que vocês fazem com meu e-mail?",
    a: "Guardamos apenas o e-mail e a preferência de alerta, e usamos os dois só para enviar a notificação que você pediu. Não vendemos nem compartilhamos a lista.",
  },
  {
    q: "De onde vêm os preços?",
    a: "Do nosso rastreador, que acompanha as páginas dos discos na Amazon Brasil e registra cada mudança de preço. É a mesma base que alimenta o gráfico de 12 meses de cada disco no site.",
  },
];

export default async function AlertasPage() {
  let count = 0;
  try {
    count = await getDiscoCount();
  } catch {
    // Count is decorative here — the form works without it.
  }

  const faqJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: toJsonLd({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Alertas de preço", item: `${SITE_URL}/alertas` },
            ],
          }),
        }}
      />

      {/* useSearchParams needs a Suspense boundary now that the shared loading.tsx
          (which used to provide one) is gone. The form lives in its own client
          component so this route can stay a server component and export metadata —
          a "use client" page cannot. */}
      <Suspense fallback={<div className="max-w-xl mx-auto px-4 py-8" />}>
        <AlertasForm />
      </Suspense>

      <div className="max-w-xl mx-auto px-4 pb-16 flex flex-col gap-12">
        <section>
          <h2 className="font-display text-xl font-black text-cream mb-5">
            Como funciona o alerta de preço
          </h2>
          <ol className="flex flex-col gap-4">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span
                  className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs font-bold tabular-nums"
                  aria-hidden="true"
                >
                  {s.n}
                </span>
                <div className="min-w-0">
                  <h3 className="text-cream text-sm font-semibold mb-1">{s.t}</h3>
                  <p className="text-dust text-sm leading-relaxed">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="font-display text-xl font-black text-cream mb-3">
            Por que vale a pena esperar o preço cair
          </h2>
          <p className="text-dust text-sm leading-relaxed">
            Preço de vinil na Amazon oscila bastante: o mesmo disco pode variar dezenas de reais ao
            longo de um mês, sem aviso e sem virar promoção anunciada. Como o Garimpa Vinil registra
            o preço{count > 0 ? ` de mais de ${count.toLocaleString("pt-BR")} discos` : " dos discos"}{" "}
            ao longo do tempo, dá para ver qual é o valor normal de cada título e qual foi o menor
            preço já registrado — e então esperar por ele em vez de pagar o preço do dia.
          </p>
          <p className="text-dust text-sm leading-relaxed mt-3">
            O alerta existe para você não precisar acompanhar isso na mão. Você define o valor que
            considera justo e só volta a pensar no assunto quando ele aparecer. Se ainda estiver
            escolhendo, veja as{" "}
            <Link href="/ofertas" className="text-gold hover:underline">
              ofertas do momento
            </Link>{" "}
            ou navegue pelo{" "}
            <Link href="/disco" className="text-gold hover:underline">
              catálogo completo
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-black text-cream mb-5">
            Perguntas frequentes
          </h2>
          <dl className="flex flex-col gap-5">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt className="text-cream text-sm font-semibold mb-1.5">{f.q}</dt>
                <dd className="text-dust text-sm leading-relaxed">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}
