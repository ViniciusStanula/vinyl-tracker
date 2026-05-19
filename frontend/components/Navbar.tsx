"use client";

import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import SearchBar from "./SearchBar";

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

const NAV_LINKS = [
  { href: "/disco",                 label: "Discos"       },
  { href: "/artistas-mais-ouvidos", label: "Mais Ouvidos" },
  { href: "/sobre",                 label: "Sobre"        },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <nav className="sticky top-0 z-50 bg-record/95 backdrop-blur-md border-b border-groove/60">
        <div className="max-w-7xl mx-auto px-4 h-[62px] flex items-center gap-2 sm:gap-4">

          {/* ── Brand ── */}
          <Link
            href="/"
            className="flex items-center gap-3 shrink-0 group"
            aria-label="Garimpa Vinil — página inicial"
          >
            <VinylLogo />
            <div className="hidden md:flex flex-col leading-none">
              <span className="font-display text-[21px] font-black text-cream tracking-tight">
                Garimpa
              </span>
              <span className="text-gold text-[9px] tracking-[0.38em] uppercase font-semibold mt-px">
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
          <div className="hidden sm:flex items-center gap-0.5 shrink-0">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  pathname === href
                    ? "text-cream font-semibold"
                    : "text-dust hover:text-gold hover:bg-groove/40"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* ── Mobile hamburger ── */}
          <button
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
      </nav>

      {/* ── Mobile drawer ── */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-record/60 backdrop-blur-[2px] sm:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <nav
            id="mobile-nav"
            className="fixed top-[62px] left-0 right-0 z-40 bg-sleeve border-b border-groove shadow-2xl sm:hidden"
            aria-label="Menu principal"
          >
            <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={pathname === href ? "page" : undefined}
                  className={`px-4 py-3 rounded-xl text-base transition-colors active:scale-[0.98] ${
                    pathname === href
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
