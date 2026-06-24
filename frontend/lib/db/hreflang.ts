import { prisma } from "@/lib/db/prisma";
import { cache } from "react";
import { unstable_cache } from "next/cache";

// unstable_cache (not just React cache) so this read does not force the
// artista/estilo routes out of static prerender — same reasoning as
// getHreflangRecord below. Used in generateMetadata where an uncached DB read
// would otherwise make the whole route dynamic.
const _getHreflangSlug = unstable_cache(
  async (type: string, slug: string): Promise<boolean> => {
    const row = await prisma.hreflangSlug.findFirst({
      where: { type, slug },
      select: { slug: true },
    });
    return row !== null;
  },
  ["hreflang-slug"],
  { tags: ["hreflang"], revalidate: 86400 },
);
export const getHreflangSlug = cache(_getHreflangSlug);

// unstable_cache (not just React cache) so this read does not force /disco/[slug]
// out of ISR — React cache() only dedupes within a single render and is not a Next
// data-cache boundary. Own "hreflang" tag + 24h TTL: peer-site mappings change
// rarely and independently of price crawls. React cache() outer wrapper preserves
// the within-render dedup between generateMetadata and the page component.
const _getHreflangRecord = unstable_cache(
  async (asin: string): Promise<string | null> => {
    const row = await prisma.hreflangRecord.findUnique({
      where: { asin },
      select: { peerSlug: true },
    });
    return row?.peerSlug ?? null;
  },
  ["hreflang-record"],
  { tags: ["hreflang"], revalidate: 86400 },
);
export const getHreflangRecord = cache(_getHreflangRecord);
