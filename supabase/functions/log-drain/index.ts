// Supabase Edge Function: Vercel Log Drain receiver.
//
// Replaces the Vercel route at /api/log-drain. Hosting the receiver OFF Vercel
// is the whole point: Vercel logs every edge request, including deliveries to a
// receiver hosted ON Vercel — a self-feed loop that was ~97% of all bot_hits
// rows (2.0M/day vs 43k real). A Supabase-hosted receiver isn't in Vercel's
// edge logs, so nothing re-drains. Loop broken.
//
// Secrets to set (supabase secrets set ...):
//   LOG_DRAIN_SECRET  — same value configured on the Vercel Log Drain
//   DATABASE_URL      — pooled Postgres URL (same one Prisma uses, port 6543)
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const DRAIN_SECRET = Deno.env.get("LOG_DRAIN_SECRET");
const sql = postgres(Deno.env.get("DATABASE_URL")!, { prepare: false });

// ── Bot detection (ported from frontend/lib/bots.ts) ──────────────────────
type BotCategory =
  | "search" | "ai_training" | "ai_assistant"
  | "seo_tool" | "social" | "mcp_client" | "other";
interface BotDef { name: string; pattern: string; category: BotCategory }

// Order matters: specific patterns before their prefixes.
const BOTS: BotDef[] = [
  { name: "Googlebot-Image", pattern: "googlebot-image", category: "search" },
  { name: "Googlebot", pattern: "googlebot", category: "search" },
  { name: "Google-Extended", pattern: "google-extended", category: "ai_training" },
  { name: "GoogleOther", pattern: "googleother", category: "search" },
  { name: "Bingbot", pattern: "bingbot", category: "search" },
  { name: "OAI-SearchBot", pattern: "oai-searchbot", category: "ai_assistant" },
  { name: "ChatGPT-User", pattern: "chatgpt-user", category: "ai_assistant" },
  { name: "GPTBot", pattern: "gptbot", category: "ai_training" },
  { name: "Claude-SearchBot", pattern: "claude-searchbot", category: "ai_assistant" },
  { name: "Claude-User", pattern: "claude-user", category: "ai_assistant" },
  { name: "ClaudeBot", pattern: "claudebot", category: "ai_training" },
  { name: "anthropic-ai", pattern: "anthropic-ai", category: "ai_training" },
  { name: "Perplexity-User", pattern: "perplexity-user", category: "ai_assistant" },
  { name: "PerplexityBot", pattern: "perplexitybot", category: "ai_assistant" },
  { name: "Amazonbot", pattern: "amazonbot", category: "ai_assistant" },
  { name: "Applebot-Extended", pattern: "applebot-extended", category: "ai_training" },
  { name: "Applebot", pattern: "applebot", category: "search" },
  { name: "Bytespider", pattern: "bytespider", category: "ai_training" },
  { name: "CCBot", pattern: "ccbot", category: "ai_training" },
  { name: "meta-externalagent", pattern: "meta-externalagent", category: "ai_training" },
  { name: "FacebookBot", pattern: "facebookbot", category: "social" },
  { name: "DuckDuckBot", pattern: "duckduckbot", category: "search" },
  { name: "YandexBot", pattern: "yandexbot", category: "search" },
  { name: "AhrefsBot", pattern: "ahrefsbot", category: "seo_tool" },
  { name: "SemrushBot", pattern: "semrushbot", category: "seo_tool" },
  { name: "Baiduspider", pattern: "baiduspider", category: "search" },
  { name: "PetalBot", pattern: "petalbot", category: "search" },
  { name: "SeznamBot", pattern: "seznambot", category: "search" },
  { name: "MistralAI-User", pattern: "mistralai-user", category: "ai_assistant" },
  { name: "cohere-ai", pattern: "cohere-ai", category: "ai_training" },
  { name: "Diffbot", pattern: "diffbot", category: "other" },
  { name: "ImagesiftBot", pattern: "imagesift", category: "ai_training" },
  { name: "MJ12bot", pattern: "mj12bot", category: "seo_tool" },
  { name: "DotBot", pattern: "dotbot", category: "seo_tool" },
  { name: "unmatched", pattern: "bot", category: "other" },
  { name: "unmatched", pattern: "crawler", category: "other" },
  { name: "unmatched", pattern: "spider", category: "other" },
  { name: "unmatched", pattern: "scrape", category: "other" },
  { name: "http-client", pattern: "python-requests", category: "other" },
  { name: "http-client", pattern: "python-httpx", category: "other" },
  { name: "http-client", pattern: "aiohttp", category: "other" },
  { name: "http-client", pattern: "go-http-client", category: "other" },
  { name: "http-client", pattern: "curl/", category: "other" },
  { name: "http-client", pattern: "wget/", category: "other" },
  { name: "http-client", pattern: "node-fetch", category: "other" },
  { name: "http-client", pattern: "undici", category: "other" },
  { name: "http-client", pattern: "axios/", category: "other" },
  { name: "http-client", pattern: "okhttp", category: "other" },
  { name: "http-client", pattern: "java/", category: "other" },
  { name: "http-client", pattern: "libwww-perl", category: "other" },
];

function detectBot(ua: string): BotDef | null {
  if (!ua) return null;
  const s = ua.toLowerCase();
  for (const bot of BOTS) if (s.includes(bot.pattern)) return bot;
  return null;
}

// ── Vercel signature: HMAC-SHA1(rawBody) hex, compared constant-time ───────
async function signatureOk(rawBody: string, header: string | null): Promise<boolean> {
  if (!DRAIN_SECRET) return true; // no secret configured yet — accept (set it!)
  if (!header) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(DRAIN_SECRET),
    { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

interface LogEntry {
  requestId?: string;
  id?: string;
  proxy?: {
    path?: string; method?: string; referer?: string; clientIp?: string;
    region?: string; userAgent?: string | string[]; requestId?: string;
    statusCode?: number;
  };
}

function verifyHeader(req: Request): HeadersInit {
  const v = req.headers.get("x-vercel-verify");
  return v ? { "x-vercel-verify": v } : {};
}

Deno.serve(async (req) => {
  const headers = verifyHeader(req);

  // Vercel ownership-verification handshake.
  if (req.method === "GET") return new Response("ok", { status: 200, headers });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers });

  const raw = await req.text();
  if (!(await signatureOk(raw, req.headers.get("x-vercel-signature")))) {
    return new Response("invalid signature", { status: 401, headers });
  }

  // NDJSON (one JSON object per line); JSON-array batches also tolerated.
  const entries: LogEntry[] = [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try { entries.push(...(JSON.parse(trimmed) as LogEntry[])); } catch { /* ignore */ }
  } else {
    for (const line of trimmed.split("\n")) {
      if (!line) continue;
      try { entries.push(JSON.parse(line) as LogEntry); } catch { /* skip */ }
    }
  }

  const rows: Record<string, unknown>[] = [];
  for (const e of entries) {
    const p = e.proxy;
    if (!p) continue;
    const ua = Array.isArray(p.userAgent) ? p.userAgent[0] : p.userAgent;
    if (!ua) continue;

    const fullPath = p.path ?? "/";
    // Drop self-logging (the old Vercel route, until removed) and static assets.
    if (fullPath === "/api/log-drain" || fullPath.startsWith("/_next/")) continue;

    const bot = detectBot(ua);
    const qIdx = fullPath.indexOf("?");
    rows.push({
      path: qIdx === -1 ? fullPath : fullPath.slice(0, qIdx),
      query: qIdx === -1 ? null : fullPath.slice(qIdx),
      user_agent: ua.slice(0, 512),
      bot_name: bot?.name ?? null,
      bot_category: bot?.category ?? null,
      method: p.method ?? "GET",
      status: p.statusCode ?? null,
      ip: p.clientIp ?? null,
      region: p.region ?? null,
      referer: p.referer ?? null,
      request_id: e.requestId ?? p.requestId ?? null,
    });
  }

  if (rows.length > 0) {
    try {
      // ON CONFLICT honours the partial unique index (WHERE request_id IS NOT
      // NULL), dropping repeat deliveries of the same request.
      const cols = ["path", "query", "user_agent", "bot_name", "bot_category",
        "method", "status", "ip", "region", "referer", "request_id"] as const;
      await sql`
        insert into bot_hits ${sql(rows, ...cols)}
        on conflict (request_id) where request_id is not null do nothing
      `;
    } catch (err) {
      console.error("[log-drain] insert failed:", err);
    }
  }

  // Always 200 fast so Vercel does not retry/back off the drain.
  return new Response("ok", { status: 200, headers });
});
