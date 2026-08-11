import Link from "next/link";

/**
 * Links to the other browse hubs, at the foot of every facet listing.
 *
 * Facet pages were dead ends laterally: /decada/1970 linked to other decades
 * and nothing else, so the only route from a decade to a style or a country was
 * back through the home page. The hubs themselves were the ones paying for it —
 * /decadas had no inbound links at all before this.
 *
 * The current hub is dropped from the row so a page never links to the section
 * it already belongs to.
 */
const HUBS = [
  { key: "estilos", href: "/estilos", label: "Estilos" },
  { key: "decadas", href: "/decadas", label: "Décadas" },
  { key: "paises", href: "/paises", label: "Países" },
  { key: "gravadoras", href: "/gravadoras", label: "Gravadoras" },
  { key: "vinil-colorido", href: "/vinil-colorido", label: "Vinil colorido" },
  { key: "edicao", href: "/edicao", label: "Edições especiais" },
  { key: "artistas", href: "/artistas", label: "Artistas" },
] as const;

export type FacetHubKey = (typeof HUBS)[number]["key"];

export default function FacetHubs({
  atual,
  className = "",
}: {
  atual?: FacetHubKey;
  className?: string;
}) {
  const hubs = HUBS.filter((h) => h.key !== atual);

  return (
    <nav aria-labelledby="outros-hubs-heading" className={className}>
      <p id="outros-hubs-heading" className="text-dust text-xs font-semibold uppercase tracking-widest mb-2">
        Explorar de outro jeito
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {hubs.map((h) => (
          <li key={h.key}>
            <Link
              href={h.href}
              className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-groove border border-wax/40 text-parchment hover:text-cream hover:border-wax/70 transition-colors"
            >
              {h.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
