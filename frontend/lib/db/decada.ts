import { prisma } from "@/lib/db/prisma";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { DECADES } from "@/lib/decadas";

export type DecadaListItem = { start: number; discoCount: number };

const _getDecadasList = unstable_cache(
  async (): Promise<DecadaListItem[]> => {
    const rows = await prisma.$queryRaw<{ decade: number; disco_count: bigint }[]>`
      SELECT (ano / 10) * 10 AS decade, COUNT(*) AS disco_count
      FROM (
        -- Original album year, the earlier of MusicBrainz and the Discogs
        -- master. Same reconciliation the record page and the listing use, so
        -- a count here can never disagree with the page it links to.
        SELECT LEAST(
                 NULLIF(substring(mb_first_release_date from '^[0-9]{4}'), '')::int,
                 discogs_master_year
               ) AS ano
        FROM "Disco"
        WHERE disponivel = TRUE
          AND (format IS NULL OR format = 'vinyl')
          AND price_count >= 5
      ) t
      WHERE ano IS NOT NULL
      GROUP BY decade
    `;
    const counts = new Map<number, number>();
    for (const r of rows) counts.set(Number(r.decade), Number(r.disco_count));
    return DECADES.map((start) => ({ start, discoCount: counts.get(start) ?? 0 }));
  },
  ["decadas-list"],
  { tags: ["prices"], revalidate: 14400 },
);

export const getDecadasList = cache(_getDecadasList);
