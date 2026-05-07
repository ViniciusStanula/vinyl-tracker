import Link from "next/link";

export const metadata = {
  title: "Política de Privacidade — Garimpa Vinil",
  description: "Como o Garimpa Vinil coleta, usa e protege seus dados.",
  alternates: { canonical: "/politica-de-privacidade" },
};

export default function PoliticaDePrivacidadePage() {
  return (
    <main id="main-content" className="max-w-3xl mx-auto px-4 py-8">
      <nav className="mb-6 text-sm text-dust flex gap-2">
        <Link href="/" className="hover:text-gold transition-colors">Início</Link>
        <span>›</span>
        <span className="text-parchment">Política de Privacidade</span>
      </nav>

      <header className="mb-8">
        <h1 className="font-display text-3xl font-black text-cream leading-tight">
          Política de Privacidade
        </h1>
        <p className="mt-2 text-dust text-sm">Última atualização: maio de 2026</p>
      </header>

      <div className="flex flex-col gap-6 text-sm text-parchment leading-relaxed">

        <section className="bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-lg font-bold text-cream mb-3">Quem somos</h2>
          <p>
            O <span className="text-cream font-medium">Garimpa Vinil</span> é um rastreador de preços de discos de vinil na Amazon Brasil,
            operado de forma independente. Não somos afiliados à Amazon além do programa de associados (Amazon Associates).
          </p>
        </section>

        <section className="bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-lg font-bold text-cream mb-3">Dados que coletamos</h2>
          <p className="mb-3">
            Não coletamos dados pessoais identificáveis. O site não possui cadastro, login ou formulários que capturem seu nome, e-mail ou qualquer informação pessoal.
          </p>
          <p>
            Podemos utilizar ferramentas de analytics (como Google Analytics) que coletam dados agregados e anônimos sobre o uso do site — páginas visitadas, tempo de sessão e dados de dispositivo — conforme os Termos de Serviço do Google.
          </p>
        </section>

        <section className="bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-lg font-bold text-cream mb-3">Cookies</h2>
          <p className="mb-3">
            O site pode utilizar cookies técnicos essenciais para o funcionamento correto das páginas e cookies de analytics para medir o uso do site de forma anônima.
          </p>
          <p>
            Links para a Amazon podem conter cookies de rastreamento de afiliados. Ao clicar nesses links, você estará sujeito à Política de Privacidade da Amazon.
          </p>
        </section>

        <section className="bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-lg font-bold text-cream mb-3">Programa de Associados Amazon</h2>
          <p>
            O Garimpa Vinil participa do Programa de Associados da Amazon Brasil. Ao clicar em links de produtos e realizar uma compra qualificada, recebemos uma pequena comissão sem custo adicional para você. Essa comissão é como o site se sustenta.
          </p>
        </section>

        <section className="bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-lg font-bold text-cream mb-3">Contato</h2>
          <p>
            Dúvidas sobre esta política? Entre em contato pelo canal do Telegram:{" "}
            <a
              href="https://t.me/garimpavinil"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline"
            >
              t.me/garimpavinil
            </a>
          </p>
        </section>

      </div>
    </main>
  );
}
