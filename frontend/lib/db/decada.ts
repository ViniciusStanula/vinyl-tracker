import { prisma } from "@/lib/db/prisma";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { DECADES } from "@/lib/decadas";

export type DecadaListItem = { start: number; discoCount: number };

const _getDecadasList = unstable_cache(
  async (): Promise<DecadaListItem[]> => {
    const rows = await prisma.$queryRaw<{ decade: number; disco_count: bigint }[]>`
      SELECT (substring(mb_first_release_date from '^[0-9]{4}')::int / 10) * 10 AS decade,
             COUNT(*) AS disco_count
      FROM "Disco"
      WHERE disponivel = TRUE
        AND (format IS NULL OR format = 'vinyl')
        AND price_count >= 5
        AND mb_first_release_date ~ '^[0-9]{4}'
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
