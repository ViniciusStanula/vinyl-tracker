import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/prisma";

// Two-layer cache (same pattern as disco.ts):
// - unstable_cache: persists across requests, 30-min TTL, purged by the
//   crawler webhook via the "prices" tag. The home page is dynamic-rendered
//   (searchParams), so without this every visit ran a live COUNT(*).
// - React cache(): deduplicates generateMetadata + page component within
//   the same render so the unstable_cache is hit only once per request.
const _getDiscoCount = unstable_cache(
  async (): Promise<number> =>
    prisma.disco.count({ where: { disponivel: true, priceCount: { gte: 5 }, OR: [{ format: null }, { format: "vinyl" }] } }),
  ["home-disco-count"],
  { tags: ["prices"], revalidate: 14400 },
);

export const getDiscoCount = cache(() => _getDiscoCount());
