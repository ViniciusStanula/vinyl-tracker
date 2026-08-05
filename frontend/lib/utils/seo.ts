const TITLE_LIMIT = 60;
const DESC_LIMIT  = 155;

/**
 * If title exceeds Google's display limit, drop the suffix after the last " | ".
 * If still over the limit, truncate at a word boundary.
 */
export function truncateTitle(title: string, limit = TITLE_LIMIT): string {
  if (title.length <= limit) return title;
  const pipeIdx = title.lastIndexOf(" | ");
  const withoutSuffix = pipeIdx !== -1 ? title.slice(0, pipeIdx) : title;
  if (withoutSuffix.length <= limit) return withoutSuffix;
  const cut = withoutSuffix.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
}

/**
 * Picks the longest title that fits, from candidates ordered longest-first.
 *
 * Prefer this over truncateTitle wherever the candidates can be written out.
 * truncateTitle severs the end of a string mid-phrase, and the end is where
 * these templates put the words worth keeping — it left 1,825 artist pages
 * titled "… em Vinil (1 disco) — Histórico de" with the phrase cut in half.
 * Dropping a whole component (the disc count, the brand) always reads better
 * than amputating the last one.
 *
 * The final candidate is used as-is if nothing fits, so make it one that
 * always will — or accept that it gets hard-truncated.
 */
export function pickTitle(candidates: string[], limit = TITLE_LIMIT): string {
  for (const candidate of candidates) {
    if (candidate.length <= limit) return candidate;
  }
  return truncateTitle(candidates[candidates.length - 1], limit);
}

/**
 * Truncates description to Google's snippet limit, breaking at a word boundary.
 */
export function truncateDesc(desc: string, limit = DESC_LIMIT): string {
  if (desc.length <= limit) return desc;
  const cut = desc.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + "…";
}
