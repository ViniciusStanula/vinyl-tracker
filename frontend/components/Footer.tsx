import Link from "next/link";

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

const TELEGRAM_URL = "https://t.me/garimpavinil";

const NAV_LINKS = [
  { label: "Início",                href: "/" },
  { label: "Todos os Discos",       href: "/disco" },
  { label: "Artistas mais Ouvidos", href: "/artistas-mais-ouvidos" },
  { label: "Guias de Vinil",        href: "/guias" },
  { label: "Sobre o Site",          href: "/sobre" },
];

const LEGAL_LINKS = [
  { label: "Política de Privacidade", href: "/politica-de-privacidade" },
  { label: "Termos de Uso",           href: "/termos-de-uso" },
  { label: "Mapa do Site",            href: "/sitemap" },
];

const TOP_ESTILOS = [
  { nome: "Rock",       slug: "rock" },
  { nome: "Jazz",       slug: "jazz" },
  { nome: "Pop",        slug: "pop" },
  { nome: "Clássica",   slug: "classical" },
  { nome: "Hip-Hop",    slug: "hip-hop" },
  { nome: "Blues",      slug: "blues" },
  { nome: "Eletrônica", slug: "electronic" },
  { nome: "Soul",       slug: "soul" },
  { nome: "Folk",       slug: "folk" },
  { nome: "Metal",      slug: "metal" },
  { nome: "Samba",      slug: "samba" },
  { nome: "MPB",        slug: "mpb" },
];

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-widest font-semibold text-dust mb-3">
      {children}
    </p>
  );
}

function FooterLink({ href, children, external }: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      className="text-dust hover:text-cream transition-colors leading-snug"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </Link>
  );
}

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-groove bg-record">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8 text-sm">

          {/* ── Brand ────────────────────────────────── */}
          <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
            <div>
              <p className="font-display font-bold text-cream text-base mb-1">Garimpa Vinil</p>
              <p className="text-dust text-xs leading-relaxed">
                Catálogo de discos de vinil na Amazon Brasil com preços atualizados regularmente.
              </p>
            </div>

            <Link
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 self-start px-3 py-2 rounded-lg border border-groove hover:border-gold/50 bg-sleeve hover:bg-sleeve/80 transition-colors group"
              aria-label="Canal de ofertas no Telegram"
            >
              <TelegramIcon className="w-4 h-4 text-[#29ABE2] shrink-0" />
              <span className="text-xs text-dust group-hover:text-cream transition-colors">Canal de Ofertas</span>
            </Link>
          </div>

          {/* ── Navegar ──────────────────────────────── */}
          <nav aria-label="Navegação do rodapé" className="col-span-1 flex flex-col">
            <FooterHeading>Navegar</FooterHeading>
            <ul className="flex flex-col gap-2">
              {NAV_LINKS.map(({ label, href }) => (
                <li key={href}>
                  <FooterLink href={href}>{label}</FooterLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* ── Explorar por Estilo ───────────────────── */}
          <nav aria-label="Explorar por estilo musical" className="col-span-2 md:col-span-1 flex flex-col">
            <FooterHeading>Explorar por Estilo</FooterHeading>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
              {TOP_ESTILOS.map(({ nome, slug }) => (
                <li key={slug}>
                  <FooterLink href={`/estilo/${slug}`}>{nome}</FooterLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* ── Legal ────────────────────────────────── */}
          <div className="col-span-1 flex flex-col">
            <FooterHeading>Legal</FooterHeading>
            <ul className="flex flex-col gap-2">
              {LEGAL_LINKS.map(({ label, href }) => (
                <li key={href}>
                  <FooterLink href={href}>{label}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────── */}
      <div className="border-t border-groove/50 px-4 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-dust">
          <p>© {new Date().getFullYear()} Garimpa Vinil</p>
          <p className="sm:text-right sm:max-w-md">
            Como Associado Amazon, ganhamos comissão nas compras qualificadas sem custo adicional para você.{" "}
            <Link href="/sobre" className="hover:text-parchment transition-colors underline underline-offset-2">
              Saiba mais
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
