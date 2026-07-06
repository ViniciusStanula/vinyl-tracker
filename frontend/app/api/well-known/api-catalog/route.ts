import { NextResponse } from "next/server";
import { SITE_URL as SITE } from "@/lib/siteUrl";

// RFC 9727 API catalog, served at /.well-known/api-catalog via next.config rewrite.
// Content type must be application/linkset+json (RFC 9264), hence a route handler
// instead of a static public/ file.

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(
    {
      linkset: [
        {
          anchor: `${SITE}/api/mcp`,
          "service-doc": [
            { href: `${SITE}/llms.txt`, type: "text/plain" },
            {
              href: `${SITE}/.well-known/agent-skills/garimpa-vinil/SKILL.md`,
              type: "text/markdown",
            },
          ],
        },
      ],
    },
    { headers: { "Content-Type": "application/linkset+json" } },
  );
}
