"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Suggestion = { href: string; label: string; description: string };

function getSuggestions(pathname: string): { heading: string; items: Suggestion[] } {
  if (pathname.startsWith("/artista/")) {
    return {
      heading: "Talvez você esteja procurando:",
      items: [
        { href: "/artistas-mais-ouvidos", label: "Artistas mais ouvidos", description: "Top mundial com melhores ofertas em vinil" },
        { href: "/disco",                 label: "Todos os discos",        description: "Explore todo o catálogo em promoção" },
      ],
    };
  }

  if (pathname.startsWith("/disco/")) {
    return {
      heading: "Talvez você esteja procurando:",
      items: [
        { href: "/disco",                label: "Todos os discos",         description: "Explore todo o catálogo em promoção" },
        { href: "/discos-abaixo-de-200", label: "Discos abaixo de R$ 200", description: "As melhores ofertas abaixo de R$ 200" },
      ],
    };
  }

  if (pathname.startsWith("/estilo/")) {
    return {
      heading: "Talvez você esteja procurando:",
      items: [
        { href: "/disco",                label: "Todos os discos",         description: "Explore todo o catálogo em promoção" },
        { href: "/artistas-mais-ouvidos", label: "Artistas mais ouvidos",  description: "Top mundial com melhores ofertas em vinil" },
      ],
    };
  }

  return {
    heading: "Explore o catálogo:",
    items: [
      { href: "/disco",                 label: "Todos os discos",         description: "Explore todo o catálogo em promoção" },
      { href: "/discos-abaixo-de-200",  label: "Discos abaixo de R$ 200", description: "As melhores ofertas abaixo de R$ 200" },
      { href: "/artistas-mais-ouvidos", label: "Artistas mais ouvidos",   description: "Top mundial com melhores ofertas em vinil" },
    ],
  };
}

export default function NotFoundSuggestions() {
  const pathname = usePathname();
  const { heading, items } = getSuggestions(pathname);

  return (
    <div className="w-full mt-8 pt-8 border-t border-groove/60">
      <p className="text-dust text-xs uppercase tracking-widest mb-4">{heading}</p>
      <ul className="flex flex-col gap-2 text-left">
        {items.map(({ href, label, description }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-sleeve hover:bg-wax/60 active:scale-[0.99] transition-colors group"
            >
              <span className="text-gold text-lg leading-none select-none group-hover:translate-x-0.5 transition-transform">→</span>
              <span className="flex flex-col min-w-0">
                <span className="text-cream text-sm font-semibold leading-tight">{label}</span>
                <span className="text-dust text-xs leading-tight mt-0.5">{description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
