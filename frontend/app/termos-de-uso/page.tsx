import Link from "next/link";

export const metadata = {
  title: "Termos de Uso — Garimpa Vinil",
  description: "Termos e condições de uso do Garimpa Vinil.",
  alternates: { canonical: "/termos-de-uso" },
};

export default function TermosDeUsoPage() {
  return (
    <main id="main-content" className="max-w-3xl mx-auto px-4 py-8">
      <nav className="mb-6 text-sm text-dust flex gap-2">
        <Link href="/" className="hover:text-gold transition-colors">Início</Link>
        <span>›</span>
        <span className="text-parchment">Termos de Uso</span>
      </nav>

      <header className="mb-8">
        <h1 className="font-display text-3xl font-black text-cream leading-tight">
          Termos de Uso
        </h1>
        <p className="mt-2 text-dust text-sm">Última atualização: maio de 2026</p>
      </header>

      <div className="flex flex-col gap-6 text-sm text-parchment leading-relaxed">

        <section className="bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-lg font-bold text-cream mb-3">Aceitação dos Termos</h2>
          <p>
            Ao acessar e utilizar o <span className="text-cream font-medium">Garimpa Vinil</span>, você concorda com os termos descritos nesta página. Se não concordar com algum ponto, recomendamos que não utilize o site.
          </p>
        </section>

        <section className="bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-lg font-bold text-cream mb-3">Objetivo do Site</h2>
          <p className="mb-3">
            O Garimpa Vinil é um serviço de monitoramento de preços de discos de vinil na Amazon Brasil. As informações de preço são coletadas automaticamente e atualizadas a cada 2 horas.
          </p>
          <p>
            Os preços exibidos são informativos e podem não refletir o valor exato no momento da compra. Sempre verifique o preço atual na página do produto na Amazon antes de finalizar qualquer transação.
          </p>
        </section>

        <section className="bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-lg font-bold text-cream mb-3">Precisão das Informações</h2>
          <p className="mb-3">
            Nos esforçamos para manter os dados atualizados e precisos, mas não garantimos que as informações estejam sempre corretas, completas ou atuais. Preços, disponibilidade e condições de produtos podem mudar sem aviso prévio.
          </p>
          <p>
            O Garimpa Vinil não se responsabiliza por decisões de compra baseadas exclusivamente nas informações exibidas no site.
          </p>
        </section>

        <section className="bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-lg font-bold text-cream mb-3">Links de Afiliados</h2>
          <p>
            Links para produtos na Amazon são links de afiliado do Programa de Associados Amazon. Ao clicar e realizar uma compra qualificada, recebemos uma comissão sem custo adicional para você. Os preços e a disponibilidade dos produtos são de responsabilidade exclusiva da Amazon.
          </p>
        </section>

        <section className="bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-lg font-bold text-cream mb-3">Propriedade Intelectual</h2>
          <p>
            O conteúdo original do site — textos, código, design e estrutura — é de propriedade do Garimpa Vinil. Imagens de produtos, nomes e marcas pertencem aos seus respectivos proprietários.
          </p>
        </section>

        <section className="bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-lg font-bold text-cream mb-3">Alterações nos Termos</h2>
          <p>
            Podemos atualizar estes termos a qualquer momento. O uso contínuo do site após as alterações implica aceitação dos novos termos.
          </p>
        </section>

        <section className="bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-lg font-bold text-cream mb-3">Contato</h2>
          <p>
            Dúvidas sobre estes termos? Entre em contato pelo e-mail{" "}
            <a
              href="mailto:contato@garimpavinil.com.br"
              className="text-gold hover:underline"
            >
              contato@garimpavinil.com.br
            </a>
          </p>
        </section>

      </div>
    </main>
  );
}
