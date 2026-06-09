import { cache } from "react";
import { prisma } from "@/lib/db/prisma";

// cache() deduplicates across generateMetadata + page component in the same request.
export const getDiscoCount = cache(async function getDiscoCount(): Promise<number> {
  return prisma.disco.count({ where: { disponivel: true, priceCount: { gte: 5 } } });
});
