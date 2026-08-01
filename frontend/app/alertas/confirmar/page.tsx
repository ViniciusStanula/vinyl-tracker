import Link from "next/link";

export const metadata = {
  title: "Confirmação de alerta — Garimpa Vinil",
  robots: { index: false },
};

type Props = { searchParams: Promise<{ ok?: string; erro?: string }> };

export default async function ConfirmarPage({ searchParams }: Props) {
  const { ok, erro } = await searchParams;

  if (ok) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-sleeve border border-groove rounded-xl p-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-deallit/10 border border-deallit/30 mx-auto mb-4">
            <svg className="w-6 h-6 text-deallit" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-black text-cream mb-3">
            Alerta confirmado
          </h1>
          <p className="text-parchment text-sm leading-relaxed mb-6">
            Tudo certo. Você receberá um e-mail quando o preço cair para o valor que você escolheu.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-gold hover:bg-goldlit text-record font-bold text-sm px-6 py-3 rounded-xl transition-colors"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  const mensagem =
    erro === "link-expirado"
      ? "O link de confirmação expirou ou já foi usado. Cadastre o alerta novamente."
      : erro === "link-invalido"
        ? "Link inválido. Verifique se copiou o endereço completo do e-mail."
        : "Ocorreu um erro inesperado. Tente novamente.";

  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <div className="bg-sleeve border border-groove rounded-xl p-8">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-cut/10 border border-cut/30 mx-auto mb-4">
          <svg className="w-6 h-6 text-cutlit" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h1 className="font-display text-2xl font-black text-cream mb-3">
          Não foi possível confirmar
        </h1>
        <p className="text-parchment text-sm leading-relaxed mb-6">{mensagem}</p>
        <Link
          href="/alertas"
          className="inline-flex items-center justify-center bg-gold hover:bg-goldlit text-record font-bold text-sm px-6 py-3 rounded-xl transition-colors"
        >
          Criar novo alerta
        </Link>
      </div>
    </div>
  );
}
