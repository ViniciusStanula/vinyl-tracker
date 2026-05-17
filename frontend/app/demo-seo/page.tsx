// DEMO ONLY — remove before production
// Shows exactly how SEO content blocks integrate into the real artist/style page layout

import StyleTags from "@/components/StyleTags";
import Link from "next/link";

// ── Fake disco card placeholder ─────────────────────────────
function FakeDiscoCard({ deal }: { deal?: boolean }) {
  return (
    <div className="rounded-xl bg-sleeve border border-groove overflow-hidden">
      <div className="aspect-square bg-groove/60 animate-pulse" />
      <div className="p-3 space-y-1.5">
        <div className="h-3 bg-groove rounded w-3/4" />
        <div className="h-2.5 bg-groove/60 rounded w-1/2" />
        <div className="h-4 bg-groove rounded w-1/3 mt-2" />
        {deal && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-deal/20 text-deallit border border-deal/30">
            Boa Oferta
          </span>
        )}
      </div>
    </div>
  );
}

// ── SEO content block — short intro (above the fold) ────────
function ArtistIntroBlock() {
  return (
    <div className="mb-5 bg-sleeve border border-groove rounded-xl px-5 py-4">
      <p className="text-parchment text-sm leading-relaxed">
        Taylor Swift é uma cantora e compositora americana cuja carreira atravessou country, pop e indie folk —
        tornando-se uma das artistas mais vendidas da história. Conhecida por álbuns autobiográficos e relançamentos
        históricos em vinil, seu catálogo físico é disputado entre colecionadores do mundo inteiro.
      </p>
    </div>
  );
}

// ── SEO content block — full bio (below the fold) ───────────
function ArtistBioBlock() {
  return (
    <section className="mt-10">
      <div className="bg-sleeve border border-groove rounded-xl p-6">
        <h2 className="font-display text-xl font-bold text-cream mb-3">Sobre Taylor Swift</h2>
        <p className="text-parchment text-sm leading-relaxed mb-3">
          Nascida em 13 de dezembro de 1989 em West Reading, Pensilvânia, Taylor Alison Swift iniciou a carreira
          em Nashville aos 14 anos, assinando com a Big Machine Records. Seu álbum de estreia em 2006 estabeleceu
          uma voz única no country contemporâneo, misturando narrativas pessoais com melodias acessíveis.
        </p>
        <p className="text-parchment text-sm leading-relaxed mb-3">
          A transição para o pop com <em>1989</em> (2014) foi um divisor de águas: quatro Grammys, incluindo Álbum do Ano,
          e dezenas de milhões de cópias vendidas. O ciclo de relançamentos "Taylor's Version" — iniciado em 2021 para
          recuperar os direitos de seu catálogo — gerou uma demanda inédita por vinis originais e relançamentos especiais,
          elevando preços no mercado secundário global.
        </p>
        <p className="text-parchment text-sm leading-relaxed">
          Seus vinis se tornaram objetos de coleção: edições coloridas exclusivas, box sets limitados e variantes
          de lojas independentes (como o "splatter vinyl" do <em>Midnights</em>) são frequentemente esgotados em horas.
        </p>
      </div>
    </section>
  );
}

// ── SEO content block — estilo intro (above the fold) ───────
function EstiloIntroBlock() {
  return (
    <div className="mb-5 bg-sleeve border border-groove rounded-xl px-5 py-4">
      <p className="text-parchment text-sm leading-relaxed">
        Pop é o gênero musical mais comercialmente dominante do séc. XX e XXI — caracterizado por melodias
        cativantes, estruturas de verso-refrão e produção polida. Seu catálogo em vinil abrange décadas de
        evolução sonora, de ABBA a Beyoncé.
      </p>
    </div>
  );
}

// ── SEO content block — estilo bio (below the fold) ─────────
function EstiloBioBlock() {
  return (
    <section className="mt-10">
      <div className="bg-sleeve border border-groove rounded-xl p-6">
        <h2 className="font-display text-xl font-bold text-cream mb-3">Sobre o estilo Pop</h2>
        <p className="text-parchment text-sm leading-relaxed mb-3">
          O pop como gênero definido emergiu nos anos 1950 e 60, derivado do rock and roll e do rhythm & blues.
          Com a Beatlemania e o British Invasion, a música pop tornou-se fenômeno global, estabelecendo padrões
          de produção e distribuição que moldaram a indústria fonográfica por décadas.
        </p>
        <p className="text-parchment text-sm leading-relaxed mb-3">
          Nos anos 1980, o synth-pop e o dance-pop expandiram as fronteiras do gênero: Michael Jackson, Madonna
          e Prince dominaram as paradas enquanto a MTV transformava música em espetáculo visual. O vinil dessa
          era é especialmente valorizado pela qualidade de masterização analógica dos estúdios da época.
        </p>
        <p className="text-parchment text-sm leading-relaxed">
          O pop contemporâneo convive com subgêneros como electropop, indie pop e hyperpop, mas a nostalgia
          pelo vinil dos grandes nomes — de ABBA ao Thriller — mantém alta demanda no mercado de colecionadores.
        </p>
      </div>
    </section>
  );
}

export default function DemoSeoPage() {
  const FAKE_STYLES = ["pop", "country", "indie folk", "synth-pop"];

  return (
    <main id="main-content" className="max-w-7xl mx-auto px-4 py-8 space-y-24">

      {/* ── DEMO BADGE ───────────────────────────────────────── */}
      <div className="rounded-lg border border-gold/30 bg-gold/10 px-4 py-2 text-gold text-xs font-mono text-center">
        DEMO — pré-visualização de como o conteúdo SEO aparece nas páginas reais
      </div>

      {/* ════════════════════════════════════════════════════════
          DEMO — PÁGINA DE ARTISTA (/artista/taylor-swift)
      ════════════════════════════════════════════════════════ */}
      <div>
        <p className="text-dust text-xs font-mono uppercase tracking-widest mb-6 border-b border-groove pb-2">
          /artista/taylor-swift — com blocos de conteúdo SEO inseridos
        </p>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-dust mb-6 flex-wrap">
          <Link href="/" className="hover:text-cream transition-colors">Início</Link>
          <span>›</span>
          <span className="text-parchment">Taylor Swift</span>
        </nav>

        {/* Header — igual ao real */}
        <header className="mb-4">
          <h1 className="font-display text-3xl font-bold text-cream">Taylor Swift</h1>
          <p className="mt-1 text-dust text-sm">23 discos encontrados</p>
          <StyleTags tags={FAKE_STYLES} />
        </header>

        {/* ▶ NOVO: bloco intro curto — entra aqui, acima do grid */}
        <ArtistIntroBlock />

        {/* SortBar placeholder */}
        <div className="mb-4 flex gap-2">
          {["Maior desconto", "Menor preço", "Mais avaliados"].map((s) => (
            <span key={s} className="px-3 py-1.5 rounded-full text-xs border border-groove text-dust">
              {s}
            </span>
          ))}
        </div>

        {/* Disco grid — cards placeholder */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <FakeDiscoCard key={i} deal={i < 3} />
          ))}
        </div>

        {/* ▶ NOVO: bio completa + discografia + curiosidades — abaixo do grid */}
        <ArtistBioBlock />
      </div>

      {/* ════════════════════════════════════════════════════════
          DEMO — PÁGINA DE ESTILO (/estilo/pop)
      ════════════════════════════════════════════════════════ */}
      <div>
        <p className="text-dust text-xs font-mono uppercase tracking-widest mb-6 border-b border-groove pb-2">
          /estilo/pop — com blocos de conteúdo SEO inseridos
        </p>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-dust mb-6 flex-wrap">
          <Link href="/" className="hover:text-cream transition-colors">Início</Link>
          <span>›</span>
          <span className="text-parchment">Pop</span>
        </nav>

        {/* Header */}
        <header className="mb-4">
          <h1 className="font-display text-3xl font-bold text-cream">Pop</h1>
          <p className="mt-1 text-dust text-sm">187 discos encontrados</p>
        </header>

        {/* ▶ NOVO: intro curto */}
        <EstiloIntroBlock />

        {/* SortBar placeholder */}
        <div className="mb-4 flex gap-2">
          {["Maior desconto", "Menor preço", "Mais avaliados"].map((s) => (
            <span key={s} className="px-3 py-1.5 rounded-full text-xs border border-groove text-dust">
              {s}
            </span>
          ))}
        </div>

        {/* Disco grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <FakeDiscoCard key={i} deal={i < 2} />
          ))}
        </div>

        {/* ▶ NOVO: bio completa */}
        <EstiloBioBlock />
      </div>

    </main>
  );
}
