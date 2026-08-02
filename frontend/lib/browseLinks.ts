/**
 * Browse links shared by the footer and the header's mega menu.
 *
 * These lists lived inside Footer.tsx. The mega menu shows the same dimensions,
 * and two copies of "which styles do we surface" would drift the first time one
 * was edited — the menu would promote a style the footer had dropped, or link a
 * decade /decada/[decada] 404s on.
 *
 * The footer renders these in full; the menu slices the top N, so ordering is
 * significant: most-searched first, not alphabetical.
 */

/** Hub pages for each browse dimension. */
export const BROWSE_LINKS = [
  { label: "Estilos Musicais", href: "/estilos" },
  { label: "Décadas",          href: "/decadas" },
  { label: "Países",           href: "/paises" },
  { label: "Discos até R$200", href: "/discos-abaixo-de-200" },
];

/**
 * Decade pages. Must stay within DECADES in lib/decadas.ts —
 * /decada/[decada] 404s outside it, so 1950 is excluded despite having
 * ~233 records.
 */
export const TOP_DECADAS = [1960, 1970, 1980, 1990, 2000, 2010, 2020];

/**
 * Country pages, slugs derived from the PT-BR name (US -> "estados-unidos").
 * Brasil is lifted above its inventory rank because this is a pt-BR audience;
 * the rest follow available-record count.
 */
export const TOP_PAISES = [
  { nome: "Brasil",         slug: "brasil" },
  { nome: "Estados Unidos", slug: "estados-unidos" },
  { nome: "Reino Unido",    slug: "reino-unido" },
  { nome: "Canadá",         slug: "canada" },
  { nome: "Alemanha",       slug: "alemanha" },
  { nome: "Austrália",      slug: "australia" },
  { nome: "Suécia",         slug: "suecia" },
  { nome: "França",         slug: "franca" },
];

export const TOP_ESTILOS = [
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

/**
 * How many of each list the mega menu shows before its "Ver todos" link.
 *
 * Seven, because a group a user has to read rather than glance at stops being
 * navigation and becomes a page. The full lists stay in the footer, and each
 * column ends with a link to the hub that holds the rest.
 */
export const MENU_PREVIEW_COUNT = 7;
