import Link from "next/link";

// Care/buying guides that apply to any vinyl record. Linked from the high-crawl
// product surfaces (disco, estilo) so Googlebot — which hammers those pages —
// has a path to the guides, which were otherwise orphaned (only reachable via
// home + the /guias index) and barely crawled.
const CARE_GUIDES = [
  { href: "/guias/como-cuidar-de-discos-de-vinil",  label: "Como cuidar do vinil" },
  { href: "/guias/como-avaliar-estado-disco-vinil", label: "Como avaliar o estado" },
  { href: "/guias/vinil-180g-vale-a-pena",          label: "Vinil 180g vale a pena?" },
  { href: "/guias/vinil-colorido-e-picture-disc",   label: "Colorido e picture disc" },
] as const;

export default function GuiasRelacionados({ className = "" }: { className?: string }) {
  return (
    <section aria-labelledby="guias-rel-heading" className={className}>
      <p id="guias-rel-heading" className="text-dust text-xs font-semibold uppercase tracking-widest mb-2">
        Guias de Vinil
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {CARE_GUIDES.map((g) => (
          <li key={g.href}>
            <Link
              href={g.href}
              className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-groove border border-wax/40 text-dust hover:text-parchment hover:border-wax/70 transition-colors"
            >
              {g.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
