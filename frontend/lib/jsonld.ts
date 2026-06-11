/**
 * Serialize an object for a <script type="application/ld+json"> tag.
 * Escapes "</" so DB-driven content can never close the script tag (XSS).
 * Every JSON-LD emission must go through this helper — no raw JSON.stringify.
 */
export function toJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/<\//g, "<\\/");
}
