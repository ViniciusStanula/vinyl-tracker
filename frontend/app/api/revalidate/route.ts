import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { artistaTag, estiloTag, paisTag } from "@/lib/cacheTags";
import { slugifyArtist } from "@/lib/utils/slugify";
import { slugifyStyle } from "@/lib/utils/styleUtils";
import { ISO2_TO_SLUG } from "@/lib/paises";

// Fail closed: an unset REVALIDATE_SECRET must never authenticate
// (`undefined !== undefined` would otherwise let every request through).
function secretMatches(provided: unknown): boolean {
  const expected = process.env.REVALIDATE_SECRET;
  if (typeof provided !== "string" || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || !secretMatches(body.secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (Array.isArray(body.paths) && body.paths.length > 0) {
    for (const path of body.paths as string[]) {
      revalidatePath(path);
    }
    return NextResponse.json({ revalidated: true, paths: body.paths.length, at: new Date().toISOString() });
  }
  // "none": dead-man's-switch ping only. Lets the crawler confirm the site is
  // reachable at end-of-run (so the workflow's failure step still fires on an
  // outage) without re-purging a tag that a prior call this same run already
  // covered — avoids a no-op double regen of every "prices"-tagged page.
  if (body.tag === "none") {
    return NextResponse.json({ revalidated: false, tag: "none", at: new Date().toISOString() });
  }

  // Per-entity purge: the crawler sends the tags for exactly the records and
  // artists it observed this run, instead of purging "prices" and marking all
  // ~42,000 record + artist pages stale when only ~4,200 were looked at.
  //
  // Entity tags are validated by shape rather than an allowlist (there are
  // ~31,000 possible values). The prefix set is closed and the slug charset is
  // restricted, so a leaked secret still cannot purge an arbitrary tag.
  //
  // `artistNames` / `styleTags` / `countryCodes` carry raw values rather than
  // slugs, and this handler maps them to tags itself. The mapping rules
  // (slugifyArtist's NFD folding + "LAST, FIRST" inversion, slugifyStyle's NFD
  // folding, the ISO2->slug lookup table) live in TypeScript only; a Python
  // reimplementation in the crawler could drift and leave a page stale
  // forever. Sending the raw value keeps one copy of each rule.
  const hasTags = Array.isArray(body.tags) && body.tags.length > 0;
  const hasNames = Array.isArray(body.artistNames) && body.artistNames.length > 0;
  const hasStyleTags = Array.isArray(body.styleTags) && body.styleTags.length > 0;
  const hasCountryCodes = Array.isArray(body.countryCodes) && body.countryCodes.length > 0;
  if (hasTags || hasNames || hasStyleTags || hasCountryCodes) {
    const ENTITY_TAG = /^(disco|artista|estilo|pais|decada)-[a-z0-9-]{1,120}$/;
    const rawTags = hasTags ? (body.tags as unknown[]) : [];
    const accepted = rawTags.filter(
      (t): t is string => typeof t === "string" && ENTITY_TAG.test(t),
    );
    for (const t of accepted) revalidateTag(t, {});

    const rawNames = hasNames ? (body.artistNames as unknown[]) : [];
    const usableNames = rawNames
      .filter((n): n is string => typeof n === "string" && n.length <= 300)
      .map(slugifyArtist)
      .filter((s) => s.length > 0);
    // Deduped: several records by the same artist collapse to one purge.
    const artistSlugs = new Set(usableNames);
    for (const s of artistSlugs) revalidateTag(artistaTag(s), {});

    const rawStyleTags = hasStyleTags ? (body.styleTags as unknown[]) : [];
    const usableStyleSlugs = rawStyleTags
      .filter((t): t is string => typeof t === "string" && t.length <= 300)
      .map(slugifyStyle)
      .filter((s) => s.length > 0);
    const styleSlugs = new Set(usableStyleSlugs);
    for (const s of styleSlugs) revalidateTag(estiloTag(s), {});

    const rawCountryCodes = hasCountryCodes ? (body.countryCodes as unknown[]) : [];
    const usablePaisSlugs = rawCountryCodes
      .filter((c): c is string => typeof c === "string")
      .map((c) => ISO2_TO_SLUG[c.toUpperCase()])
      .filter((s): s is string => Boolean(s));
    const paisSlugs = new Set(usablePaisSlugs);
    for (const s of paisSlugs) revalidateTag(paisTag(s), {});

    return NextResponse.json({
      revalidated: true,
      tags: accepted.length,
      artists: artistSlugs.size,
      estilos: styleSlugs.size,
      paises: paisSlugs.size,
      rejected:
        rawTags.length - accepted.length + (rawNames.length - usableNames.length),
      at: new Date().toISOString(),
    });
  }

  // Standard ISR: tag invalidation triggers stale-while-revalidate. First request
  // after the crawl gets the previous cached HTML instantly; background regen fires
  // and the next request gets fresh prices. No blocking render, no skeleton.
  //
  // `tag` selects the scope: "deals" (frequent in-loop deal refresh) regenerates
  // only the deal surfaces (home, ofertas, carousel); "prices" (default) now
  // covers the aggregate surfaces only — the listings whose ?page= variants
  // cannot be enumerated — and is still fired once at end-of-run as a safety net.
  // Allowlisted so a leaked secret can't purge arbitrary tags.
  const ALLOWED_TAGS = new Set(["prices", "deals"]);
  const tag = typeof body.tag === "string" && ALLOWED_TAGS.has(body.tag) ? body.tag : "prices";
  revalidateTag(tag, {});
  return NextResponse.json({ revalidated: true, tag, at: new Date().toISOString() });
}
