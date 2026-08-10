import Link from "next/link";

import FooterSection from "@/components/FooterSection";
import {
  BROWSE_LINKS,
  TOP_DECADAS,
  TOP_ESTILOS,
  TOP_PAISES,
} from "@/lib/browseLinks";

function PixIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.504 3.504 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422 3.79 6.699h1.492a2.483 2.483 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.482 2.482 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.482 2.482 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.483 2.483 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156" />
    </svg>
  );
}

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

// Top guides linked site-wide from the footer so they aren't reachable only via
// home + the /guias index (they were barely crawled).
//
// Excludes the used-record grading guide: the footer renders on product pages,
// and the catalog lists NEW records. It stays reachable via the /guias index.
const GUIA_LINKS = [
  { label: "Toca-discos para iniciantes", href: "/guias/toca-discos-para-iniciantes" },
  { label: "Pré-amplificador phono",   href: "/guias/pre-amplificador-phono" },
  { label: "Como cuidar do vinil",     href: "/guias/como-cuidar-de-discos-de-vinil" },
  { label: "Vinil 180g vale a pena?",  href: "/guias/vinil-180g-vale-a-pena" },
];


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
        {/* 5 columns on desktop so "Explorar por Estilo" gets a real one. It
            used to be a 2-column grid nested inside the Explorar column, which
            split that column in half and produced a phantom sub-column aligning
            with nothing else in the footer. */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-8 text-sm">

          {/* ── Brand ────────────────────────────────── */}
          <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
            <div>
              <p className="font-display font-bold text-cream text-base mb-1">Garimpa Vinil</p>
              <p className="text-dust text-xs leading-relaxed">
                Catálogo de discos de vinil na Amazon Brasil com preços atualizados regularmente.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
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

              <Link
                href="/apoie"
                className="inline-flex items-center gap-2 self-start px-3 py-2 rounded-lg border border-groove hover:border-gold/50 bg-sleeve hover:bg-sleeve/80 transition-colors group"
                aria-label="Apoie o site via Pix"
              >
                <PixIcon className="w-4 h-4 text-gold shrink-0" />
                <span className="text-xs text-dust group-hover:text-cream transition-colors">Apoie o Site</span>
              </Link>
            </div>
          </div>

          {/* ── Navegar ──────────────────────────────── */}
          <nav aria-label="Navegação do rodapé" className="col-span-1 flex flex-col">
            <FooterSection heading="Navegar">
              <ul className="flex flex-col gap-3 md:gap-2">
                {NAV_LINKS.map(({ label, href }) => (
                  <li key={href}>
                    <FooterLink href={href}>{label}</FooterLink>
                  </li>
                ))}
              </ul>
            </FooterSection>

            <div className="mt-5">
              <FooterSection heading="Guias">
                <ul className="flex flex-col gap-3 md:gap-2">
                  {GUIA_LINKS.map(({ label, href }) => (
                    <li key={href}>
                      <FooterLink href={href}>{label}</FooterLink>
                    </li>
                  ))}
                </ul>
              </FooterSection>
            </div>
          </nav>

          {/* ── Explorar + Décadas ───────────────────── */}
          <nav aria-label="Explorar o catálogo" className="col-span-1 flex flex-col">
            <FooterSection heading="Explorar">
              <ul className="flex flex-col gap-3 md:gap-2">
                {BROWSE_LINKS.map(({ label, href }) => (
                  <li key={href}>
                    <FooterLink href={href}>{label}</FooterLink>
                  </li>
                ))}
              </ul>
            </FooterSection>

            <div className="mt-5">
              <FooterSection heading="Décadas">
                <ul className="flex flex-col gap-3 md:gap-2">
                  {TOP_DECADAS.map((d) => (
                    <li key={d}>
                      <FooterLink href={`/decada/${d}`}>Anos {d}</FooterLink>
                    </li>
                  ))}
                </ul>
              </FooterSection>
            </div>
          </nav>

          {/* ── Explorar por Estilo ──────────────────── */}
          <nav aria-label="Explorar por estilo musical" className="col-span-1 flex flex-col">
            <FooterSection heading="Explorar por Estilo">
              <ul className="flex flex-col gap-3 md:gap-2">
                {TOP_ESTILOS.map(({ nome, slug }) => (
                  <li key={slug}>
                    <FooterLink href={`/estilo/${slug}`}>{nome}</FooterLink>
                  </li>
                ))}
              </ul>
            </FooterSection>
          </nav>

          {/* ── Países + Legal ───────────────────────── */}
          <div className="col-span-1 flex flex-col">
            <nav aria-label="Explorar por país">
              <FooterSection heading="Países">
                <ul className="flex flex-col gap-3 md:gap-2">
                  {TOP_PAISES.map(({ nome, slug }) => (
                    <li key={slug}>
                      <FooterLink href={`/pais/${slug}`}>{nome}</FooterLink>
                    </li>
                  ))}
                </ul>
              </FooterSection>
            </nav>

            <div className="mt-5">
              <FooterSection heading="Legal">
                <ul className="flex flex-col gap-3 md:gap-2">
                  {LEGAL_LINKS.map(({ label, href }) => (
                    <li key={href}>
                      <FooterLink href={href}>{label}</FooterLink>
                    </li>
                  ))}
                </ul>
              </FooterSection>
            </div>
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
