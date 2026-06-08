import { prisma } from "@/lib/db/prisma";

export async function getHreflangSlug(type: string, slug: string): Promise<boolean> {
  const row = await prisma.hreflangSlug.findFirst({
    where: { type, slug },
    select: { slug: true },
  });
  return row !== null;
}

export async function getHreflangRecord(asin: string): Promise<string | null> {
  const row = await prisma.hreflangRecord.findUnique({
    where: { asin },
    select: { peerSlug: true },
  });
  return row?.peerSlug ?? null;
}
