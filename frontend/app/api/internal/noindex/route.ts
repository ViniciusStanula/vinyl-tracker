import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { slugifyArtist } from "@/lib/utils/slugify";

const ACCENT_FROM = "áàâãäåéèêëíìîïóòôõöúùûüçñý";
const ACCENT_TO   = "aaaaaaeeeeiiiioooouuuucny";

async function checkArtistaNoindex(slug: string): Promise<boolean> {
  const AF = Prisma.raw(`'${ACCENT_FROM}'`);
  const AT = Prisma.raw(`'${ACCENT_TO}'`);

  const candidates = await prisma.$queryRaw<{ artista: string }[]>`
    SELECT DISTINCT artista FROM "Disco"
    WHERE left(
            regexp_replace(
              regexp_replace(translate(lower(artista), ${AF}, ${AT}), '[^a-z0-9]+', '-', 'g'),
              '^-+|-+$', '', 'g'
            ), 60) = ${slug}
       OR left(
            regexp_replace(
              regexp_replace(
                translate(
                  lower(trim(split_part(artista, ',', 2)) || ' ' || trim(split_part(artista, ',', 1))),
                  ${AF}, ${AT}
                ),
                '[^a-z0-9]+', '-', 'g'
              ),
              '^-+|-+$', '', 'g'
            ), 60) = ${slug}
  `;

  const variants = candidates
    .map((r) => r.artista)
    .filter((a) => slugifyArtist(a) === slug);

  if (variants.length === 0) return false;

  const [countResult, metaRows] = await Promise.all([
    prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COUNT(*) AS total FROM "Disco"
      WHERE artista = ANY(${variants})
        AND disponivel = TRUE
        AND (format IS NULL OR format = 'vinyl')
        AND price_count >= 5
    `,
    prisma.$queryRaw<[{ bioShortPt: string | null }]>`
      SELECT bio_short_pt AS "bioShortPt"
      FROM "ArtistMeta"
      WHERE artista = ANY(${variants})
      LIMIT 1
    `,
  ]);

  const total = Number(countResult[0].total);
  const hasBio = Boolean(metaRows[0]?.bioShortPt);
  return total <= 2 && !hasBio;
}

async function checkEstiloNoindex(slug: string): Promise<boolean> {
  const canonicalRow = await prisma.$queryRaw<{ tag: string }[]>`
    WITH tags AS (
      SELECT DISTINCT unnest(string_to_array(lastfm_tags, ', ')) AS tag
      FROM "Disco"
      WHERE lastfm_tags IS NOT NULL AND lastfm_tags != ''
    )
    SELECT tag FROM tags
    WHERE regexp_replace(
            regexp_replace(
              translate(lower(tag), ${ACCENT_FROM}, ${ACCENT_TO}),
              '[^a-z0-9]+', '-', 'g'
            ),
            '^-+|-+$', '', 'g'
          ) = ${slug}
    LIMIT 1
  `;

  if (canonicalRow.length === 0) return false;
  const canonical = canonicalRow[0].tag;

  const [countResult, bioRows] = await Promise.all([
    prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COUNT(*) AS total FROM "Disco"
      WHERE LOWER(${canonical}) = ANY(string_to_array(LOWER(lastfm_tags), ', '))
        AND disponivel = TRUE
        AND (format IS NULL OR format = 'vinyl')
        AND price_count >= 5
    `,
    prisma.$queryRaw<[{ bioShortPt: string | null }]>`
      SELECT bio_short_pt AS "bioShortPt"
      FROM "EstiloMeta"
      WHERE tag = LOWER(${canonical})
      LIMIT 1
    `,
  ]);

  const total = Number(countResult[0].total);
  const hasBio = Boolean(bioRows[0]?.bioShortPt);
  return total <= 3 && !hasBio;
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  const slug = request.nextUrl.searchParams.get("slug");

  if (!type || !slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ noindex: false });
  }

  try {
    let noindex = false;
    if (type === "artista") noindex = await checkArtistaNoindex(slug);
    else if (type === "estilo") noindex = await checkEstiloNoindex(slug);

    return NextResponse.json(
      { noindex },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
    );
  } catch (err) {
    console.error("[noindex-check] error:", err);
    return NextResponse.json({ noindex: false });
  }
}
