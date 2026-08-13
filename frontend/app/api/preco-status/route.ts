import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createRateLimiter, clientIp } from "@/lib/rateLimit";

// When the crawler last looked at a record, served live rather than baked into
// the page HTML.
//
// The "Atual" label used to render server-side from the newest HistoricoPreco
// row. That put an observation timestamp in the cached output, so every crawl
// changed the page even when the price was identical — and Vercel only bills
// an ISR write when the regenerated output differs. 89% of observations record
// an unchanged price, so almost all of that spend bought nothing.
//
// Fetching the timestamp instead keeps the freshness promise (it is now live
// rather than as-of-last-rebuild) while leaving the cached HTML untouched.
// Bots don't run this — they don't execute JS — which is the point: they are
// 99.85% of traffic and none of them need the label.
const checkRateLimit = createRateLimiter(60);

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(clientIp(req));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const slug = (req.nextUrl.searchParams.get("slug") ?? "").slice(0, 200);
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const ultimo = await prisma.historicoPreco
    .findFirst({
      where: { disco: { slug } },
      orderBy: { capturadoEm: "desc" },
      select: { capturadoEm: true, precoBrl: true },
    })
    .catch(() => null);

  if (!ultimo) {
    return NextResponse.json({ checkedAt: null, preco: null }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    { checkedAt: ultimo.capturadoEm.toISOString(), preco: Number(ultimo.precoBrl) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
