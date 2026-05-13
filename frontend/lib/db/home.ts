import { prisma } from "@/lib/db/prisma";

export async function getDiscoCount(): Promise<number> {
  return prisma.disco.count({ where: { disponivel: true, priceCount: { gte: 5 } } });
}
