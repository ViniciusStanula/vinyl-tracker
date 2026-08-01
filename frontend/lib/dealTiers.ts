/**
 * Single source of truth for deal badge tiers.
 *
 * These definitions previously lived in five places — the homepage legend,
 * /disco, /ofertas, llms.txt and the MCP endpoint — and had drifted into four
 * mutually contradictory descriptions of the same badge ("com desconto ativo"
 * vs "abaixo da média histórica" vs "below 30-day average"). Import from here
 * instead of restating them.
 *
 * Must stay in sync with crawler/deal_scorer.py `_compute_raw_score`, which
 * assigns the scores. Each tier is a strict superset of the one below it.
 *
 * IMPORTANT — `low_all_time` is the lowest price *we have recorded*, and the
 * price history only begins 2026-04-14. Copy must never claim an all-time or
 * "de todos os tempos" low. "Desde que começamos a acompanhar" is the honest
 * phrasing, and it strengthens by itself as history accumulates.
 */

export type DealTier = {
  score: 1 | 2 | 3;
  label: string;
  mark: string;
  /** Long form, used on /ofertas section headers. */
  blurb: string;
  /** Compact form, used in the one-line legend on listing pages. */
  short: string;
};

export const DEAL_TIERS: readonly DealTier[] = [
  {
    score: 3,
    label: "Melhor Preço",
    mark: "✦",
    blurb: "No menor preço desde que começamos a acompanhar este disco.",
    short: "menor preço já registrado por aqui",
  },
  {
    score: 2,
    label: "Ótima Oferta",
    mark: "✓",
    blurb: "Abaixo da média dos últimos 30 e 90 dias.",
    short: "abaixo das médias de 30 e 90 dias",
  },
  {
    score: 1,
    label: "Boa Oferta",
    mark: "",
    blurb: "Pelo menos 10% abaixo da média dos últimos 30 dias.",
    short: "10% abaixo da média de 30 dias",
  },
] as const;

export const DEAL_TIER_BY_SCORE: Record<number, DealTier> = Object.fromEntries(
  DEAL_TIERS.map((t) => [t.score, t]),
);

/** Plain-text tier lines for llms.txt and the MCP endpoint. */
export const DEAL_TIER_LINES = DEAL_TIERS.map(
  (t) => `- ${t.score} = "${t.label}" — ${t.blurb}`,
).join("\n");
