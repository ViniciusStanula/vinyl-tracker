import { NextRequest, NextResponse } from "next/server";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.garimpavinil.com.br";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const canonical = `${SITE_URL}${request.nextUrl.pathname}`;
  response.headers.set("Link", `<${canonical}>; rel="canonical"`);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|api/|sitemap|robots\\.txt).*)",
  ],
};
