// Decades we surface as hubs. Slug is the start year; label reads "anos 80".
export const DECADES = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020] as const;
export type Decade = (typeof DECADES)[number];

// Two-digit for the 1900s ("anos 80"), four-digit from 2000 on. "anos 00" and
// "anos 20" are how nobody refers to the 2000s and 2020s in pt-BR, and on a
// listing that also spans the 1920s the short form is ambiguous outright.
export const decadaLabel = (start: number) =>
  start >= 2000 ? `anos ${start}` : `anos ${String(start).slice(2)}`;

export function parseDecade(slug: string): number | null {
  const n = Number(slug);
  return DECADES.includes(n as Decade) ? n : null;
}
