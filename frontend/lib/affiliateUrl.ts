const AFFILIATE_TAG = "garimpa-vinil-20";

/**
 * Returns the outbound buy link for a Disco record.
 *
 * Amazon: appends the Associates tag (?tag=garimpa-vinil-20).
 * Any other marketplace (mercadolivre, umusicstore): the stored `url` is
 *   already final (an affiliate link, or a plain direct link) — return it
 *   untouched (tagging it would be wrong and pointless).
 *
 * `marketplace` defaults to "amazon" so existing Amazon call sites keep working.
 */
export function affiliateUrl(url: string, marketplace: string = "amazon"): string {
  if (marketplace !== "amazon") return url;
  try {
    const u = new URL(url);
    u.searchParams.set("tag", AFFILIATE_TAG);
    return u.toString();
  } catch {
    return url;
  }
}
