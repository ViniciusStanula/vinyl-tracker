import Link from "next/link";
import QRCode from "qrcode";

import CopyPixCodeButton from "@/components/CopyPixCodeButton";

const PIX_CODE =
  "00020126580014BR.GOV.BCB.PIX01365a46629d-4bba-4f33-a3df-adc6ded62ca65204000053039865802BR5925Vinicius Leineker Stanula6009SAO PAULO62140510IWgcULvPax63044D91";

export const metadata = {
  title: "Apoie o Site | Garimpa Vinil",
  description:
    "O Garimpa Vinil é mantido por uma pessoa só. Se o site te ajudou a economizar numa compra, considere apoiar via Pix.",
  robots: { index: false, follow: true },
};

export default async function ApoiePage() {
  const qrSvg = await QRCode.toString(PIX_CODE, {
    type: "svg",
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* ── Breadcrumbs ─────────────────────────────────────────── */}
      <nav className="mb-6 text-sm text-dust flex gap-2">
        <Link href="/" className="hover:text-gold transition-colors">Início</Link>
        <span>›</span>
        <span className="text-parchment">Apoie o Site</span>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <header className="relative mb-8 overflow-hidden rounded-2xl bg-sleeve border border-groove px-6 py-7 vinyl-grooves">
        <h1 className="font-display text-3xl sm:text-4xl font-black text-cream leading-tight">
          Apoie o <span className="text-gold">Garimpa Vinil</span>
        </h1>
        <p className="mt-3 text-parchment text-sm max-w-lg leading-relaxed">
          O site é feito e mantido por uma pessoa só, sem equipe nem investimento externo.
        </p>
      </header>

      {/* ── Por que ─────────────────────────────────────────────── */}
      <section className="mb-6 bg-sleeve border border-groove rounded-xl p-6">
        <h2 className="font-display text-xl font-bold text-cream mb-3">
          Por que isso importa
        </h2>
        <p className="text-parchment text-sm leading-relaxed mb-3">
          Rastrear preço de mais de 33.000 discos exige servidor, banco de dados e consultas
          automatizadas rodando o dia inteiro — tudo isso tem custo mensal. A comissão da Amazon
          ajuda, mas cobrir os custos com contribuições diretas de quem usa o site também é
          bem-vindo.
        </p>
        <p className="text-parchment text-sm leading-relaxed">
          Não é obrigatório e não destrava nenhum recurso extra. Se o Garimpa Vinil já te ajudou a
          comprar um disco no preço certo, um Pix de qualquer valor ajuda a manter o site no ar.
        </p>
      </section>

      {/* ── Pix ─────────────────────────────────────────────────── */}
      <section className="mb-6 bg-sleeve border border-groove rounded-xl p-6 flex flex-col items-center text-center">
        <h2 className="font-display text-xl font-bold text-cream mb-4">
          Contribua via Pix
        </h2>

        {/* Copy-code first: most visitors open this page on the same phone
            that has their bank app, so a QR on that same screen is unscannable. */}
        <div className="order-1 sm:order-2 mb-4 flex flex-col items-center gap-3 w-full">
          <CopyPixCodeButton code={PIX_CODE} />
          <p className="text-parchment text-xs">
            Após colar ou escanear, confira que o nome do recebedor é{" "}
            <span className="font-semibold">Vinicius Leineker Stanula</span>.
          </p>
        </div>

        <div className="order-2 sm:order-1 mb-4 flex flex-col items-center">
          <div
            className="w-40 h-40 sm:w-48 sm:h-48 bg-white rounded-lg p-2 mb-2"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="text-dust text-xs">Ou escaneie com a câmera do app do banco em outro dispositivo.</p>
        </div>

        <details className="order-3 text-xs text-dust w-full max-w-sm [&>summary::-webkit-details-marker]:hidden">
          <summary className="flex items-center justify-center gap-1.5 list-none cursor-pointer hover:text-parchment transition-colors">
            Ver código Pix completo
            <svg
              className="w-3.5 h-3.5 shrink-0 transition-transform [details[open]_&]:rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <code className="block mt-2 break-all select-all text-left bg-record/60 rounded p-2 text-xs leading-relaxed">
            {PIX_CODE}
          </code>
        </details>
      </section>

      <p className="text-dust text-xs text-center mb-4">
        Qualquer valor é bem-vindo e vai direto para os custos de infraestrutura do site.
      </p>

      <p className="text-center">
        <Link href="/disco" className="text-gold text-sm hover:underline">
          Voltar para o catálogo
        </Link>
      </p>
    </div>
  );
}
