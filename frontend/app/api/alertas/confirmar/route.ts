import { NextRequest, NextResponse } from "next/server";
import { confirmSubscription } from "@/lib/db/alertas";
import { SITE_URL } from "@/lib/siteUrl";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const token = req.nextUrl.searchParams.get("token") ?? "";

  if (!id || !token) {
    return NextResponse.redirect(`${SITE_URL}/alertas/confirmar?erro=link-invalido`);
  }

  try {
    const confirmed = await confirmSubscription(id, token);
    if (!confirmed) {
      return NextResponse.redirect(`${SITE_URL}/alertas/confirmar?erro=link-expirado`);
    }
    return NextResponse.redirect(`${SITE_URL}/alertas/confirmar?ok=1`);
  } catch {
    return NextResponse.redirect(`${SITE_URL}/alertas/confirmar?erro=servidor`);
  }
}
