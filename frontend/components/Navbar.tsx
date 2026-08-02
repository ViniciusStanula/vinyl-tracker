"use client";

import Link from "next/link";
import { Suspense, useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import SearchBar from "./SearchBar";
import MegaMenu from "./MegaMenu";
import {
  BROWSE_LINKS,
  MENU_PREVIEW_COUNT,
  TOP_DECADAS,
  TOP_ESTILOS,
  TOP_PAISES,
} from "@/lib/browseLinks";

function VinylLogo() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10 shrink-0">
      <circle cx="20" cy="20" r="19" className="fill-gold" />
      <circle cx="20" cy="20" r="16.5" fill="none" className="stroke-record" strokeWidth="1"   opacity="0.35" />
      <circle cx="20" cy="20" r="14"   fill="none" className="stroke-record" strokeWidth="0.7" opacity="0.30" />
      <circle cx="20" cy="20" r="11.5" fill="none" className="stroke-record" strokeWidth="0.6" opacity="0.25" />
      <circle cx="20" cy="20" r="9" className="fill-record" />
      <circle cx="20" cy="20" r="8"   fill="none" className="stroke-gold" strokeWidth="0.5" opacity="0.4" />
      <circle cx="20" cy="20" r="5.5" fill="none" className="stroke-gold" strokeWidth="0.4" opacity="0.25" />
      <circle cx="20" cy="20" r="2.2" className="fill-gold" opacity="0.85" />
      <circle cx="20" cy="20" r="0.9" className="fill-record" />
    </svg>
  );
}

/**
 * A section is current when the URL is that page or sits underneath it, so
 * /guias/pre-amplificador-phono still marks "Guias".
 *
 * Compared segment by segment rather than with a bare startsWith, which would
 * light up "Discos" on /discos-abaixo-de-200 — a different section whose path
 * happens to share a prefix.
 */
function isSection(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// "Discos" is absent: on desktop it is the mega-menu trigger, and in the mobile
// drawer it is the first accordion. Both render it themselves.
//
// "Artistas" is absent too. It pointed at /artistas-mais-ouvidos, a 24-name
// chart, while the 11,935-name catalogue sat at /artistas reachable only from a
// breadcrumb — one label that misdescribed whichever page it pointed at. Both
// now appear under their own names in the menu.
//
// Ofertas leads: it was reachable only from the homepage, and most visitors
// arrive on a record page from search and never see the homepage. Every product
// page shows a deal badge with no route to the page that lists them.
const NAV_LINKS = [
  { href: "/ofertas", label: "Ofertas" },
  { href: "/guias",   label: "Guias"   },
  { href: "/sobre",   label: "Sobre"   },
];

// Groups shown as accordions in the mobile drawer. Same lists the desktop panel
// and the footer use, so none of the three can drift.
const MOBILE_GROUPS = [
  {
    heading: "Estilos",
    hub: { label: "Ver todos os estilos", href: "/estilos" },
    items: TOP_ESTILOS.slice(0, MENU_PREVIEW_COUNT).map(({ nome, slug }) => ({
      label: nome,
      href: `/estilo/${slug}`,
    })),
  },
  {
    heading: "Décadas",
    hub: { label: "Ver todas as décadas", href: "/decadas" },
    items: TOP_DECADAS.map((d) => ({ label: `Anos ${d}`, href: `/decada/${d}` })),
  },
  {
    heading: "Países",
    hub: { label: "Ver todos os países", href: "/paises" },
    items: TOP_PAISES.slice(0, MENU_PREVIEW_COUNT).map(({ nome, slug }) => ({
      label: nome,
      href: `/pais/${slug}`,
    })),
  },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // One accordion at a time: two expanded groups push the rest off a phone
  // screen, and the drawer stops being navigation.
  const [expanded, setExpanded] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => { setOpen(false); setExpanded(null); }, [pathname]);

  useEffect(() => {
    if (!open) return;

    // Move focus to first nav link when drawer opens
    const firstLink = navRef.current?.querySelector<HTMLElement>("a");
    firstLink?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setTimeout(() => buttonRef.current?.focus(), 0);
        return;
      }
      if (e.key !== "Tab") return;
      const nav = navRef.current;
      if (!nav) return;
      const focusable = Array.from(nav.querySelectorAll<HTMLElement>("a[href], button"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-50 bg-record/95 backdrop-blur-md border-b border-groove/60">
        <div className="max-w-7xl mx-auto px-4 h-[62px] flex items-center gap-2 sm:gap-4">

          {/* ── Brand ── */}
          <Link
            href="/"
            className="flex items-center gap-3 shrink-0 group"
            aria-label="Garimpa Vinil — página inicial"
          >
            <VinylLogo />
            <div className="flex flex-col leading-none">
              <span className="font-display text-base md:text-[21px] font-black text-gold tracking-tight">
                Garimpa
              </span>
              <span className="hidden md:block text-parchment text-[9px] tracking-[0.38em] uppercase font-semibold mt-px">
                vinil
              </span>
            </div>
          </Link>

          {/* ── Search ── */}
          <div className="flex-1 min-w-0 max-w-2xl">
            <Suspense>
              <SearchBar />
            </Suspense>
          </div>

          {/* ── Desktop nav links ── */}
          <nav aria-label="Navegação principal" className="hidden sm:flex items-center gap-0.5 shrink-0">
            <MegaMenu isActive={isSection(pathname, "/disco")} />
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isSection(pathname, href) ? "page" : undefined}
                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                  isSection(pathname, href)
                    ? "text-cream"
                    : "text-dust hover:text-gold hover:bg-groove/40"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* ── Mobile hamburger ── */}
          <button
            ref={buttonRef}
            className="sm:hidden w-11 h-11 flex items-center justify-center rounded-lg text-parchment hover:text-cream hover:bg-groove/40 transition-colors active:scale-95 shrink-0"
            onClick={() => setOpen(v => !v)}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            {open ? (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            )}
          </button>

        </div>
      </header>

      {/* ── Mobile drawer ── */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-record/60 backdrop-blur-[2px] sm:hidden"
            onClick={() => { setOpen(false); buttonRef.current?.focus(); }}
            aria-hidden="true"
          />
          <nav
            ref={navRef}
            id="mobile-nav"
            className="fixed top-[62px] left-0 right-0 z-40 bg-sleeve border-b border-groove shadow-2xl sm:hidden"
            aria-label="Menu principal"
          >
            {/* Capped and scrollable: expanding two groups otherwise runs the
                drawer past the bottom of a phone, and the last items become
                unreachable because the drawer is fixed, not in page flow. */}
            <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1 max-h-[calc(100dvh-62px)] overflow-y-auto overscroll-contain">
              <Link
                href="/disco"
                aria-current={isSection(pathname, "/disco") ? "page" : undefined}
                className={`px-4 py-3 rounded-xl text-base transition-colors active:scale-[0.98] ${
                  isSection(pathname, "/disco")
                    ? "bg-wax text-cream font-semibold"
                    : "text-parchment hover:text-cream hover:bg-groove/60"
                }`}
              >
                Todos os discos
              </Link>

              {MOBILE_GROUPS.map(({ heading, hub, items }) => {
                const isOpen = expanded === heading;
                return (
                  <div key={heading}>
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : heading)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-base text-parchment hover:text-cream hover:bg-groove/60 transition-colors active:scale-[0.98]"
                    >
                      {heading}
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                        className={`w-4 h-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      >
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                      </svg>
                    </button>

                    {isOpen && (
                      <ul className="pl-4 pb-1 flex flex-col">
                        {items.map(({ label, href }) => (
                          <li key={href}>
                            <Link
                              href={href}
                              className="block px-4 py-2.5 rounded-lg text-[15px] text-dust hover:text-cream hover:bg-groove/60 transition-colors"
                            >
                              {label}
                            </Link>
                          </li>
                        ))}
                        <li>
                          <Link
                            href={hub.href}
                            className="block px-4 py-2.5 rounded-lg text-sm font-semibold text-gold hover:text-cream transition-colors"
                          >
                            {hub.label} →
                          </Link>
                        </li>
                      </ul>
                    )}
                  </div>
                );
              })}

              {BROWSE_LINKS.filter((l) => l.href === "/discos-abaixo-de-200").map(
                ({ label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    className="px-4 py-3 rounded-xl text-base text-parchment hover:text-cream hover:bg-groove/60 transition-colors active:scale-[0.98]"
                  >
                    {label}
                  </Link>
                ),
              )}

              <div className="my-1 border-t border-groove/60" />

              <Link
                href="/artistas-mais-ouvidos"
                aria-current={isSection(pathname, "/artistas-mais-ouvidos") ? "page" : undefined}
                className="px-4 py-3 rounded-xl text-base text-parchment hover:text-cream hover:bg-groove/60 transition-colors active:scale-[0.98]"
              >
                Artistas mais ouvidos
              </Link>
              <Link
                href="/artistas"
                aria-current={isSection(pathname, "/artistas") ? "page" : undefined}
                className="px-4 py-3 rounded-xl text-base text-parchment hover:text-cream hover:bg-groove/60 transition-colors active:scale-[0.98]"
              >
                Catálogo de artistas A-Z
              </Link>


              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={isSection(pathname, href) ? "page" : undefined}
                  className={`px-4 py-3 rounded-xl text-base transition-colors active:scale-[0.98] ${
                    isSection(pathname, href)
                      ? "bg-wax text-cream font-semibold"
                      : "text-parchment hover:text-cream hover:bg-groove/60"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        </>
      )}
    </>
  );
}
