import { NextRequest, NextResponse } from "next/server";
import { getCachedSuggestions } from "@/lib/db/search";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100).trim();
  if (q.length < 2) return NextResponse.json([]);

  try {
    const results = await getCachedSuggestions(q);
    return NextResponse.json(results, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json([]);
  }
}
