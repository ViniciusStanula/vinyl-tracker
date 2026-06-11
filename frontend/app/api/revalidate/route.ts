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
  // expire: 0 — immediate expiry, NOT stale-while-revalidate ("max" profile).
  // Rule Zero: the next request must block and fetch fresh prices rather than
  // serve one last response from the superseded crawl. The crawler's warm-up
  // GETs absorb the blocking render for the hottest pages.
  revalidateTag("prices", { expire: 0 });
  return NextResponse.json({ revalidated: true, at: new Date().toISOString() });
}
