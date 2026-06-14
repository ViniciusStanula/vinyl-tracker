import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

// Fail closed: an unset REVALIDATE_SECRET must never authenticate
// (`undefined !== undefined` would otherwise let every request through).
function secretMatches(provided: unknown): boolean {
  const expected = process.env.REVALIDATE_SECRET;
  if (typeof provided !== "string" || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || !secretMatches(body.secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (Array.isArray(body.paths) && body.paths.length > 0) {
    for (const path of body.paths as string[]) {
      revalidatePath(path);
    }
    return NextResponse.json({ revalidated: true, paths: body.paths.length, at: new Date().toISOString() });
  }
  // Standard ISR: tag invalidation triggers stale-while-revalidate. First request
  // after the crawl gets the previous cached HTML instantly; background regen fires
  // and the next request gets fresh prices. No blocking render, no skeleton.
  revalidateTag("prices");
  return NextResponse.json({ revalidated: true, at: new Date().toISOString() });
}
