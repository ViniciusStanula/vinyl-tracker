// The album's ORIGINAL release year, not the year this pressing was made.
//
// MusicBrainz gives us a release-GROUP date, which should be the original, but
// on reissue-heavy catalogue it frequently resolves to the modern reissue
// instead: J.J. Johnson's "The Eminent Jay Jay Johnson Vol. 1" comes back as
// 2024-10-25 when the album is from 1955. Discogs' master year is the original
// by definition, but is missing on some records that MusicBrainz matched.
//
// In both failure directions the wrong value is the LATER one, so the earlier
// of the two is the album's year. Measured on 59 records: 7 disagreed, and the
// minimum was correct in every case checked (Castle in the Sky MB 2002 /
// Discogs 1986; Selena LIVE MB 2026 / Discogs 1993).
export function originalReleaseYear(
  mbFirstReleaseDate: string | null | undefined,
  discogsMasterYear: number | null | undefined,
): string | null {
  const mbYear = Number(mbFirstReleaseDate?.slice(0, 4)) || null;
  const dgYear = discogsMasterYear ?? null;
  if (mbYear && dgYear) return String(Math.min(mbYear, dgYear));
  return String(mbYear ?? dgYear ?? "") || null;
}

// schema.org datePublished for the same album. Keeps MusicBrainz's full
// YYYY-MM-DD precision when MusicBrainz is the one describing the original
// release, and falls back to the bare Discogs year when Discogs is earlier —
// asserting a precise reissue date as the publication date is worse than
// asserting a correct year.
export function originalReleaseDatePublished(
  mbFirstReleaseDate: string | null | undefined,
  discogsMasterYear: number | null | undefined,
): string | null {
  const year = originalReleaseYear(mbFirstReleaseDate, discogsMasterYear);
  if (!year) return null;
  return mbFirstReleaseDate?.startsWith(year) ? mbFirstReleaseDate : year;
}
