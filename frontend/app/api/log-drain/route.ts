// Vercel Log Drain receiver. Vercel's proxy/middleware function is not invoked
// in prod on this Next 16.2.9 deployment (no x-grmp-proxy header, no bot_hits
// rows except local-dev ::1), so request-time bot logging is impossible from the
// app. Instead, Vercel streams every edge request log here — including hits
// served from the CDN cache, which middleware never saw — and we filter bot
// user-agents into bot_hits.
import { createHmac, timingSafeEqual } from "node:crypto";
import { detectBot } from "@/lib/bots";

// Vercel sends batched NDJSON; reading the raw body is required for signature
// verification, so opt out of any body parsing/caching.
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DRAIN_SECRET = process.env.LOG_DRAIN_SECRET;

// One edge-request log entry (subset of Vercel's schema we use).
interface LogEntry {
  proxy?: {
    path?: string;
    method?: string;
    referer?: string;
    clientIp?: string;
    region?: string;
    userAgent?: string | string[];
  };
}

function signatureOk(rawBody: string, header: string | null): boolean {
  if (!DRAIN_SECRET) return true; // no secret configured yet — accept (set it!)
  if (!header) return false;
  const expected = createHmac("sha1", DRAIN_SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Vercel's ownership-verification handshake: echo the x-vercel-verify header.
function verifyHeader(req: Request): HeadersInit {
  const v = req.headers.get("x-vercel-verify");
  return v ? { "x-vercel-verify": v } : {};
}

export async function GET(req: Request) {
  return new Response("ok", { status: 200, headers: verifyHeader(req) });
}

export async function POST(req: Request) {
  const headers = verifyHeader(req);
  const raw = await req.text();

  if (!signatureOk(raw, req.headers.get("x-vercel-signature"))) {
    return new Response("invalid signature", { status: 401, headers });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response("ok", { status: 200, headers }); // never make Vercel retry
  }

  // NDJSON: one JSON object per line. (A JSON-array format is also tolerated.)
  const entries: LogEntry[] = [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      entries.push(...(JSON.parse(trimmed) as LogEntry[]));
    } catch {
      /* ignore malformed batch */
    }
  } else {
    for (const line of trimmed.split("\n")) {
      if (!line) continue;
      try {
        entries.push(JSON.parse(line) as LogEntry);
      } catch {
        /* skip malformed line */
      }
    }
  }

  const rows = [];
  for (const e of entries) {
    const p = e.proxy;
    if (!p) continue;
    const ua = Array.isArray(p.userAgent) ? p.userAgent[0] : p.userAgent;
    if (!ua) continue;
    const bot = detectBot(ua);
    if (!bot) continue; // only recognised bots — humans add volume, no signal

    const fullPath = p.path ?? "/";
    const qIdx = fullPath.indexOf("?");
    rows.push({
      path: qIdx === -1 ? fullPath : fullPath.slice(0, qIdx),
      query: qIdx === -1 ? null : fullPath.slice(qIdx),
      user_agent: ua.slice(0, 512),
      bot_name: bot.name,
      bot_category: bot.category,
      method: p.method ?? "GET",
      ip: p.clientIp ?? null,
      country: null, // edge logs carry edge region, not visitor country
      region: p.region ?? null,
      referer: p.referer ?? null,
    });
  }

  if (rows.length > 0) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/bot_hits`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal", // anon role has no SELECT on bot_hits
        },
        body: JSON.stringify(rows), // PostgREST bulk insert
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      console.error("[log-drain] insert failed:", err);
    }
  }

  // Always 200 fast so Vercel does not retry/back off the drain.
  return new Response("ok", { status: 200, headers });
}
