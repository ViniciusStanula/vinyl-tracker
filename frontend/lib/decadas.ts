// Decades we surface as hubs. Slug is the start year; label reads "anos 80".
export const DECADES = [1960, 1970, 1980, 1990, 2000, 2010, 2020] as const;
export type Decade = (typeof DECADES)[number];

export const decadaLabel = (start: number) => `anos ${String(start).slice(2)}`;

export function parseDecade(slug: string): number | null {
  const n = Number(slug);
  return DECADES.includes(n as Decade) ? n : null;
}
