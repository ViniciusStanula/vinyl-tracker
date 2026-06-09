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
 * Truncates description to Google's snippet limit, breaking at a word boundary.
 */
export function truncateDesc(desc: string, limit = DESC_LIMIT): string {
  if (desc.length <= limit) return desc;
  const cut = desc.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + "…";
}
