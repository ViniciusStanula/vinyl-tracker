import { prisma } from "@/lib/db/prisma";
import { cache } from "react";

export const getHreflangSlug = cache(async (type: string, slug: string): Promise<boolean> => {
  const row = await prisma.hreflangSlug.findFirst({
    where: { type, slug },
    select: { slug: true },
  });
  return row !== null;
});

export const getHreflangRecord = cache(async (asin: string): Promise<string | null> => {
  const row = await prisma.hreflangRecord.findUnique({
    where: { asin },
    select: { peerSlug: true },
  });
  return row?.peerSlug ?? null;
});
