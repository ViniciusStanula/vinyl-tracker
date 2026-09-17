import { ARTISTA_REDIRECT_TARGETS } from "@/lib/redirectTargets";

/**
 * Normalizes an inverted "LAST,FIRST" artist name to "First Last".
 * Amazon sometimes stores names in this format (e.g., "SWIFT,TAYLOR").
 *
 * Only the no-space-after-comma shape is inverted. Inverting on ANY comma
 * mangled every band name that legitimately contains one: "Earth, Wind & Fire"
 * became /artista/wind-fire-earth, "Blood, Sweat & Tears" became
 * /artista/sweat-tears-blood, "Tyler, The Creator" became
 * /artista/the-creator-tyler. That was 340 artist names across 406 records
 * reading backwards, and it also SPLIT pages: "Tyler, The Creator" and
 * "Tyler The Creator" resolved to two different slugs for one artist.
 *
 * The two shapes separate cleanly in the catalogue: 11 names carry the
 * Amazon "Vaughan,stevie Ray" form with no space, and 345 are band names or
 * multi-artist credits written with ", ". Digit groups are excluded too, so
 * "10,000 Maniacs" is left alone.
 */
function uninvertName(name: string): string {
  if (!/(?<!\d),(?!\s)(?!\d)/.test(name)) return name;
  const [last, ...rest] = name.split(",");
  const first = rest.join(",").trim();
  return first ? `${first} ${last.trim()}` : name;
}

/**
 * Generates a URL-friendly slug from an artist name.
 * Must produce consistent results on every call with the same input
 * since it's used both to build links and to resolve them in the artist page.
 *
 * Normalizes inverted "LAST,FIRST" format before slugifying so that
 * "SWIFT,TAYLOR" and "Taylor Swift" both produce "taylor-swift".
 */
export function slugifyArtist(name: string): string {
  return uninvertName(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric → hyphens
    .replace(/^-+|-+$/g, "") // trim leading/trailing hyphens
    .substring(0, 60);
}

/**
 * Artist hub href, or null when the name leaves no ASCII behind to slugify --
 * 久石譲, 伊福部昭, ディアフーフ and ††† all slugify to an empty string, and the
 * bare /artista/ that resulted is a 404 linked from card grids, letter pages
 * and disco pages. Callers render the name as plain text when this is null.
 */
export function artistaHref(name: string): string | null {
  const slug = slugifyArtist(name);
  if (!slug) return null;
  return ARTISTA_REDIRECT_TARGETS[slug] ?? `/artista/${slug}`;
}
