import Link from "next/link";

const NAV_LINKS = [
  { label: "Início",                href: "/" },
  { label: "Todos os Discos",       href: "/disco" },
  { label: "Artistas mais Ouvidos", href: "/artistas-mais-ouvidos" },
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
