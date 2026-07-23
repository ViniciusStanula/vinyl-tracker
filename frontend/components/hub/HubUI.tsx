/* Shared presentation for the browse hubs (/estilos, /paises, /decadas,
   /artistas). Server-safe — no client hooks — so hubs can keep rendering their
   lists on the server. */
import Link from "next/link";

export function formatDiscos(n: number): string {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? "disco" : "discos"}`;
}

export function HubHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: React.ReactNode;
}) {
  return (
    <header className="mb-10 sm:mb-14 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-xl">
        <span className="font-mono text-gold text-[11px] font-medium uppercase tracking-[0.18em] block mb-2">
          {eyebrow}
        </span>
        <h1 className="font-display text-3xl sm:text-5xl font-black text-cream leading-tight [text-wrap:balance]">
          {title}
        </h1>
        <p className="mt-3 text-parchment text-sm leading-relaxed">{description}</p>
      </div>
      {aside && <div className="w-full lg:max-w-md">{aside}</div>}
    </header>
  );
}

export function SectionRule({
  title,
  subtitle,
  id,
  aside,
}: {
  title: string;
  subtitle?: string;
  id?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 flex-wrap border-b border-groove pb-3">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 id={id} className="font-display text-2xl sm:text-3xl font-black text-cream leading-tight">
          {title}
        </h2>
        {subtitle && (
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-parchment">
            {subtitle}
          </span>
        )}
      </div>
      {aside}
    </div>
  );
}

/* Typographic tile — no imagery. `featured` is the lead tile in a mosaic and
   carries the larger type plus an optional badge. */
export function HubTile({
  href,
  label,
  count,
  badge,
  featured = false,
}: {
  href: string;
  label: string;
  count: number;
  badge?: string;
  featured?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex h-full flex-col justify-end overflow-hidden rounded-xl border border-groove bg-gradient-to-br from-label to-record hover:border-gold transition-colors ${
        featured
          ? "min-h-[240px] sm:min-h-[340px] p-6 sm:p-8"
          : "min-h-[120px] sm:min-h-[158px] p-5"
      }`}
    >
      {badge && (
        <span className="font-mono absolute top-5 left-5 sm:top-8 sm:left-8 inline-flex items-center rounded bg-gold px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-record">
          {badge}
        </span>
      )}
      <span
        className={`font-display font-black leading-none text-cream ${
          featured ? "text-3xl sm:text-5xl" : "text-xl sm:text-2xl"
        }`}
      >
        {label}
      </span>
      <span className="mt-3 h-0.5 w-8 bg-gold rounded-full" aria-hidden="true" />
      <span className="font-mono mt-3 block text-[11px] font-medium tabular-nums text-parchment">
        {formatDiscos(count)}
      </span>
    </Link>
  );
}

/* Compact card for dense grids. */
export function HubCard({
  href,
  label,
  count,
}: {
  href: string;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col justify-between gap-2 rounded-lg border border-groove bg-sleeve px-4 py-3 hover:border-gold hover:bg-groove transition-colors"
    >
      <span className="text-cream text-sm font-semibold leading-snug line-clamp-2">{label}</span>
      <span className="font-mono text-[11px] font-medium tabular-nums text-parchment group-hover:text-gold transition-colors">
        {formatDiscos(count)}
      </span>
    </Link>
  );
}
