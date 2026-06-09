/**
 * Rewrites an Amazon media image URL to a smaller size variant.
 * The crawler stores covers as `._AC_SL1500_.jpg` (see crawler/main.py),
 * far larger than the ~208px cards render. Amazon's CDN resizes on the
 * fly based on the `._<MODIFIERS>_.` suffix, so swapping the suffix is
 * free and needs no image-optimization quota.
 *
 * Safe fallback: if the URL doesn't contain the `._XXX_.` suffix pattern
 * (or is null/empty), it is returned unchanged.
 */
const SIZE_SUFFIX_RE = /\._[A-Z0-9_,]+_\./;

export function resizeAmazonImage(url: string, size?: number): string;
export function resizeAmazonImage(url: string | null, size?: number): string | null;
export function resizeAmazonImage(url: string | null, size = 416): string | null {
  if (!url) return url;
  return url.replace(SIZE_SUFFIX_RE, `._AC_SL${size}_.`);
}
