/**
 * Discogs format descriptors, in Portuguese and short enough to read.
 *
 * The raw string concatenates every descriptor Discogs holds plus a free-text
 * colour note, which on the worst record runs to 231 characters:
 *
 *   LP, Album, Deluxe Edition, Limited Edition, Reissue, Remastered, Repress,
 *   Special Edition, Custom Tri Color Merge [Hot Pink, Bone White And Blue Jay]
 *   With Metallic Gold, Blue Jay And Hot Pink Splatter
 *
 * Three things are wrong with printing that: it is far longer than the row it
 * sits in, it repeats itself (Deluxe / Limited / Special Edition, Reissue /
 * Repress), and it is English on a Portuguese page beside a MusicBrainz type
 * that is already translated.
 *
 * Translation doubles as the filter. Anything not in the table is dropped,
 * which removes the entire colour tail without needing to describe it — the
 * vocabulary has 2,479 distinct terms and almost all of the tail is colour.
 * The colour is usually in the record's own title anyway.
 *
 * Median length is 31 characters and only 11% exceed 60, so this changes what
 * a minority of records show and leaves the rest alone.
 */

/** Ordered: size and disc count, then what the release is, then provenance,
 *  then physical traits. Rendering follows this order, not Discogs' own. */
const TERMS: [RegExp, string][] = [
  // ── how many discs, and how big ──
  [/^(\d+)xLP$/i, "$1 LPs"],
  [/^LP$/i, "LP"],
  [/^(7|10|12)"$/, '$1"'],

  // ── what it is ──
  [/^Album$/i, "Álbum"],
  [/^Compilation$/i, "Coletânea"],
  [/^Mini-Album$/i, "Mini-álbum"],
  [/^EP$/i, "EP"],
  [/^Single$/i, "Single"],
  [/^Maxi-Single$/i, "Maxi-single"],

  // ── original or not ──
  // Repress collapses into Reissue: the distinction is which run of the
  // reissue, which is not something a buyer here is choosing between.
  [/^(Reissue|Repress)$/i, "Reedição"],
  [/^Remastered$/i, "Remasterizado"],
  [/^Unofficial Release$/i, "Não oficial"],
  [/^Test Pressing$/i, "Test pressing"],
  [/^Promo$/i, "Promo"],

  // ── physical traits a buyer would actually weigh ──
  // Deluxe and Special Edition both fold into Limited Edition rather than
  // printing three synonyms in a row.
  [/^(Limited|Deluxe|Special|Collector'?s) Edition$/i, "Edição limitada"],
  [/^\d+(st|nd|rd|th) Anniversary( Edition)?$/i, "Edição de aniversário"],
  [/^Numbered$/i, "Numerado"],
  [/^Gatefold$/i, "Capa dupla"],
  // Any pressing weight, not only 180g: 140g and 150g both appear.
  [/^(\d{2,3})\s*(?:g|gram)$/i, "$1g"],
  [/^(45|33 ⅓|78) RPM$/i, "$1 RPM"],
  [/^Picture Disc$/i, "Picture disc"],
  // Mono is worth saying because stereo is the default; Stereo is not, which
  // is why it has no entry despite being the 5th most common term.
  [/^Mono$/i, "Mono"],
];

/** Beyond four the row wraps and stops being scannable. */
const MAX_TERMS = 4;

export function formatoVinilPt(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const out: string[] = [];
  for (const [pattern, replacement] of TERMS) {
    for (const part of raw.split(",")) {
      const term = part.trim();
      if (!term || !pattern.test(term)) continue;
      const label = term.replace(pattern, replacement);
      if (!out.includes(label)) out.push(label);
    }
  }

  // Discogs lists the disc count AND the bare format: a double album carries
  // both "2xLP" and "LP", which renders as "2 LPs · LP" and wastes one of the
  // four slots saying nothing.
  const counted = out.some((t) => /^\d+ LPs$/.test(t));
  const kept = counted ? out.filter((t) => t !== "LP") : out;

  return kept.length ? kept.slice(0, MAX_TERMS).join(" · ") : null;
}
