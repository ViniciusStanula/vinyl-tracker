"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import {
  BROWSE_LINKS,
  MENU_PREVIEW_COUNT,
  TOP_DECADAS,
  TOP_ESTILOS,
  TOP_PAISES,
} from "@/lib/browseLinks";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
        open ? "rotate-180" : ""
      }`}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function Column({
  heading,
  hubHref,
  hubLabel,
  children,
  onSelect,
}: {
  heading: string;
  hubHref: string;
  hubLabel: string;
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <div className="flex flex-col min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-dust mb-3">
        {heading}
      </p>
      <ul className="flex flex-col gap-1.5 mb-2">{children}</ul>
      <Link
        href={hubHref}
        onClick={onSelect}
        className="mt-auto pt-1 text-xs font-semibold text-gold hover:text-cream transition-colors"
      >
        {hubLabel} →
      </Link>
    </div>
  );
}

function MenuLink({ href, children, onSelect }: {
  href: string;
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onSelect}
        className="block py-1 text-sm text-parchment hover:text-cream transition-colors"
      >
        {children}
      </Link>
    </li>
  );
}

/**
 * The browse dimensions, opened from "Discos" in the header.
 *
 * Every way into the catalogue other than search — style, decade, country,
 * price — was reachable only from the footer, so browsing by style meant
 * scrolling past an entire product page. Most visitors arrive on a record page
 * from Google, never see the homepage, and had no route sideways from there.
 *
 * Click, not hover: hover menus have no touch equivalent, and this same panel
 * has to work on a phone. Hover also fires on the way past, which on a header
 * this dense means opening a wall of links by accident.
 *
 * "Discos" is a button rather than a link because it now does one thing —
 * disclose the panel. The catalogue itself is the first entry inside it, so the
 * destination is one keystroke further, not lost.
 */
export default function MegaMenu({ isActive }: { isActive: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointer(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    // Tabbing out of the panel closes it. The panel sits next to the trigger in
    // the DOM, so Tab walks into it naturally and there is no focus trap to
    // escape from — a menu is not a modal and should not hold focus hostage.
    function onFocusIn(e: FocusEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  // Closing here rather than in an effect on the pathname: Next.js keeps this
  // mounted across a client-side navigation, so the panel would otherwise stay
  // open on top of the page the user just asked for.
  const close = () => setOpen(false);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
          open || isActive
            ? "text-cream bg-groove/40"
            : "text-dust hover:text-gold hover:bg-groove/40"
        }`}
      >
        Discos
        <Chevron open={open} />
      </button>

      {/* Always in the DOM, toggled with `display`, rather than mounted on open.
          Conditional rendering kept these links out of the server HTML
          entirely, so the catalogue routes they point at — /artistas most of
          all, which nothing else links — were invisible to a crawler that does
          not execute the click.

          `display: none` still removes the panel from the tab order and the
          accessibility tree, so a closed menu cannot be tabbed into and needs
          no aria-hidden. The reveal animation replays each time the class
          flips back. */}
      <div
        id={panelId}
        className={`absolute right-0 top-[calc(100%+8px)] z-50 w-[min(760px,calc(100vw-2rem))] rounded-2xl border border-groove bg-sleeve shadow-2xl p-6 ${
          open ? "animate-menu-in" : "hidden"
        }`}
      >
          <nav aria-label="Explorar o catálogo">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-7">
              <Column heading="Estilos" hubHref="/estilos" hubLabel="Ver todos" onSelect={close}>
                {TOP_ESTILOS.slice(0, MENU_PREVIEW_COUNT).map(({ nome, slug }) => (
                  <MenuLink key={slug} href={`/estilo/${slug}`} onSelect={close}>
                    {nome}
                  </MenuLink>
                ))}
              </Column>

              <Column heading="Décadas" hubHref="/decadas" hubLabel="Ver todas" onSelect={close}>
                {TOP_DECADAS.map((d) => (
                  <MenuLink key={d} href={`/decada/${d}`} onSelect={close}>
                    Anos {d}
                  </MenuLink>
                ))}
              </Column>

              <Column heading="Países" hubHref="/paises" hubLabel="Ver todos" onSelect={close}>
                {TOP_PAISES.slice(0, MENU_PREVIEW_COUNT).map(({ nome, slug }) => (
                  <MenuLink key={slug} href={`/pais/${slug}`} onSelect={close}>
                    {nome}
                  </MenuLink>
                ))}
              </Column>

              {/* Artists get named entries rather than one "Artistas" link.
                  There are two artist pages and the difference matters: a 24-name
                  chart and an 11,935-name catalogue. A single label pointing at
                  either one misdescribes it. */}
              <div className="flex flex-col gap-7 min-w-0">
                <div className="flex flex-col min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-dust mb-3">
                    Artistas
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    <MenuLink href="/artistas-mais-ouvidos" onSelect={close}>
                      Mais ouvidos
                    </MenuLink>
                    <MenuLink href="/artistas" onSelect={close}>
                      Catálogo A-Z
                    </MenuLink>
                  </ul>
                </div>

                {/* The catalogue itself leads this group: "Discos" is now a
                    disclosure button, so this is the direct route to /disco. */}
                <div className="flex flex-col min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-dust mb-3">
                    Explorar
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    <MenuLink href="/disco" onSelect={close}>Todos os discos</MenuLink>
                    {BROWSE_LINKS.map(({ label, href }) => (
                      <MenuLink key={href} href={href} onSelect={close}>
                        {label}
                      </MenuLink>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </nav>
      </div>
    </div>
  );
}
