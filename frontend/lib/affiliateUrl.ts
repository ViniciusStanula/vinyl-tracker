const AFFILIATE_TAG = "garimpa-vinil-20";

export function affiliateUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("tag", AFFILIATE_TAG);
    return u.toString();
  } catch {
    return url;
  }
}
