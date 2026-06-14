import type { NextRequest } from "next/server";
import { proxy } from "./proxy";

// Re-use the same route matcher defined in proxy.ts.
export { config } from "./proxy";

export default function middleware(request: NextRequest) {
  // Block high-volume bot traffic from SG/CN/MY when the request has no
  // Portuguese Accept-Language — these are crawlers spoofing browser UAs,
  // confirmed via GA4 (0 % engagement, 0 s session, 0 conversions).
  // Legitimate PT-BR speakers in those countries still pass through.
  const country = request.headers.get("x-vercel-ip-country") ?? "";
  const lang = request.headers.get("accept-language") ?? "";
  if (
    (country === "SG" || country === "CN" || country === "MY") &&
    !lang.toLowerCase().includes("pt")
  ) {
    return new Response("", { status: 403 });
  }

  return proxy(request);
}
