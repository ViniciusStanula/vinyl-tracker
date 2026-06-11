import { NextRequest, NextResponse } from "next/server";
import { queryDiscos } from "@/lib/queryDiscos";
import { getDiscoWithPrecos } from "@/lib/db/disco";
import { getArtistaPageData } from "@/lib/db/artista";
import { toTitleCase } from "@/lib/utils/titleCase";

import { SITE_URL as SITE } from "@/lib/siteUrl";
import { createRateLimiter, clientIp } from "@/lib/rateLimit";

const MCP_VERSION = "2024-11-05";

// 30 requests per IP per minute
const checkRateLimit = createRateLimiter(30);

// ── JSON-RPC 2.0 helpers ────────────────────────────────────────────────────

type JsonRpcId = string | number | null;

function ok(id: JsonRpcId, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", result, id });
}

function rpcErr(id: JsonRpcId, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", error: { code, message }, id });
}

function textContent(obj: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}

// ── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "search_vinyl",
    description:
      "Search vinyl records available on Amazon Brasil by title or artist name. Returns current price in BRL, 30-day average, discount %, deal score, and direct URLs.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search text — matches album title or artist name (e.g. 'beatles', 'pink floyd', 'jazz piano')",
        },
        preco_max: { type: "number", description: "Maximum price in BRL (e.g. 150)" },
        sort: {
          type: "string",
          enum: ["desconto", "menor-preco", "maior-preco", "deals", "az"],
          description:
            "'desconto' = biggest discount first (default) | 'menor-preco' = cheapest first | 'deals' = deal-scored first | 'az' = alphabetical",
        },
        pagina: {
          type: "integer",
          minimum: 1,
          description: "Page number (default: 1; 24 results per page)",
        },
      },
    },
  },
  {
    name: "get_deals",
    description:
      "Get current best vinyl deals, optionally filtered by genre or max price. Sorted by deal tier (Melhor Preço > Ótima Oferta > Boa Oferta) then discount %.",
    inputSchema: {
      type: "object",
      properties: {
        genero: {
          type: "string",
          description:
            "Genre tag to filter by (e.g. 'rock', 'jazz', 'samba', 'mpb', 'classical', 'reggae'). Uses full-text search.",
        },
        preco_max: { type: "number", description: "Maximum price in BRL" },
        limite: {
          type: "integer",
          minimum: 1,
          maximum: 24,
          description: "Number of results to return (default: 10)",
        },
      },
    },
  },
  {
    name: "get_price_history",
    description:
      "Get detailed price history for a specific vinyl record: current price, 30-day average, all-time low/high, and up to 1 year of timestamped price points.",
    inputSchema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description:
            "Album slug from search results (e.g. 'the-beatles-abbey-road-vinyl'). Must be an exact slug.",
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "get_artist_albums",
    description:
      "Get all vinyl albums by a specific artist with current prices, discounts, and deal scores.",
    inputSchema: {
      type: "object",
      properties: {
        artista_slug: {
          type: "string",
          description:
            "Artist URL slug (e.g. 'taylor-swift', 'the-beatles', 'rita-lee'). Lowercase, accents stripped, spaces replaced by hyphens.",
        },
        preco_max: { type: "number", description: "Maximum price in BRL" },
        sort: {
          type: "string",
          enum: ["desconto", "menor-preco", "maior-preco", "deals"],
          description: "Sort order (default: 'desconto')",
        },
      },
      required: ["artista_slug"],
    },
  },
];

// ── Input sanitizers ────────────────────────────────────────────────────────

function sanitizeStr(v: unknown, maxLen = 200): string {
  return typeof v === "string" ? v.slice(0, maxLen).trim() : "";
}

function sanitizeSort(v: unknown, allowed: string[], fallback: string): string {
  return typeof v === "string" && allowed.includes(v) ? v : fallback;
}

function sanitizePositiveNumber(v: unknown): number | null {
  return typeof v === "number" && isFinite(v) && v > 0 ? v : null;
}

function sanitizeInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? Math.round(v) : fallback;
  return Math.max(min, Math.min(max, n));
}

// ── Shared disco formatter ──────────────────────────────────────────────────

function formatDisco(d: {
  slug: string;
  titulo: string;
  artista: string;
  precoAtual: number;
  mediaPreco: number;
  desconto: number;
  dealScore: number | null;
  rating: number | null;
  url: string;
  lastfmTags?: string | null;
}) {
  return {
    slug: d.slug,
    titulo: d.titulo,
    artista: toTitleCase(d.artista),
    generos: d.lastfmTags ? d.lastfmTags.split(", ").slice(0, 5) : [],
    preco_atual_brl: d.precoAtual,
    media_30d_brl: d.mediaPreco,
    desconto_pct: Math.round(d.desconto * 100),
    deal_score: d.dealScore,
    deal_label:
      d.dealScore === 3
        ? "Melhor Preço"
        : d.dealScore === 2
        ? "Ótima Oferta"
        : d.dealScore === 1
        ? "Boa Oferta"
        : null,
    avaliacao_amazon: d.rating,
    url_garimpa: `${SITE}/disco/${d.slug}`,
    url_amazon: d.url,
  };
}

// ── Tool executors ──────────────────────────────────────────────────────────

const SORTS_SEARCH = ["desconto", "menor-preco", "maior-preco", "deals", "az"];
const SORTS_ARTIST = ["desconto", "menor-preco", "maior-preco", "deals"];

async function execSearchVinyl(args: Record<string, unknown>) {
  const query   = sanitizeStr(args.query);
  const precoMax = sanitizePositiveNumber(args.preco_max);
  const sort    = sanitizeSort(args.sort, SORTS_SEARCH, "desconto");
  const pagina  = sanitizeInt(args.pagina, 1, 100, 1);

  const { items, total, totalPages } = await queryDiscos({
    searchTerm: query,
    sort,
    precoMax,
    page: pagina,
  });

  return textContent({
    total,
    pagina_atual: pagina,
    total_paginas: totalPages,
    resultados: items.map(formatDisco),
  });
}

async function execGetDeals(args: Record<string, unknown>) {
  const genero  = sanitizeStr(args.genero, 80);
  const precoMax = sanitizePositiveNumber(args.preco_max);
  const limite  = sanitizeInt(args.limite, 1, 24, 10);

  const { items } = await queryDiscos({
    searchTerm: genero,
    sort: "deals",
    precoMax,
    page: 1,
  });

  const deals = items.filter((d) => d.dealScore !== null).slice(0, limite);

  return textContent({
    total_encontrado: deals.length,
    nota: "deal_score: 3=Melhor Preço (all-time low), 2=Ótima Oferta (well below avg), 1=Boa Oferta (below avg)",
    deals: deals.map(formatDisco),
  });
}

async function execGetPriceHistory(args: Record<string, unknown>) {
  const slug = sanitizeStr(args.slug, 120);
  if (!slug) throw { code: -32602, message: "'slug' is required" };

  const disco = await getDiscoWithPrecos(slug);
  if (!disco) throw { code: -32602, message: `No record found for slug: "${slug}"` };

  const precos = (disco.precos ?? [])
    .map((p) => ({ data: p.capturadoEm.toISOString().slice(0, 10), preco_brl: Number(p.precoBrl) }))
    .filter((p) => p.preco_brl >= 30);

  const values = precos.map((p) => p.preco_brl);
  const current    = values.at(-1) ?? null;
  const minHistoric = values.length > 0 ? Math.min(...values) : null;
  const maxHistoric = values.length > 0 ? Math.max(...values) : null;

  return textContent({
    slug: disco.slug,
    titulo: disco.titulo,
    artista: toTitleCase(disco.artista),
    preco_atual_brl: current,
    minimo_historico_brl: minHistoric,
    maximo_historico_brl: maxHistoric,
    pontos_de_preco: precos.length,
    historico: precos,
    url_garimpa: `${SITE}/disco/${disco.slug}`,
    url_amazon: disco.url,
  });
}

async function execGetArtistAlbums(args: Record<string, unknown>) {
  const slug = sanitizeStr(args.artista_slug, 80);
  if (!slug) throw { code: -32602, message: "'artista_slug' is required" };

  const sort     = sanitizeSort(args.sort, SORTS_ARTIST, "desconto");
  const precoMax = sanitizePositiveNumber(args.preco_max);

  const data = await getArtistaPageData(slug, 1, sort, precoMax);
  if (!data) throw { code: -32602, message: `No artist found for slug: "${slug}"` };

  return textContent({
    artista: toTitleCase(data.canonical),
    total_discos: data.total,
    generos_principais: data.topStyles,
    url_garimpa: `${SITE}/artista/${slug}`,
    discos: data.items.map(formatDisco),
  });
}

// ── Main handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientIp(req));
  if (!rl.allowed) {
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32000, message: "Rate limit exceeded. Try again later." }, id: null },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return rpcErr(null, -32700, "Parse error");
  }

  if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return rpcErr(body?.id ?? null, -32600, "Invalid Request");
  }

  const method = body.method as string;
  const params = (body.params ?? {}) as Record<string, unknown>;
  const id: JsonRpcId = body.id ?? null;
  const isNotification = !("id" in body);

  // Notifications — no response body
  if (isNotification) {
    return new NextResponse(null, { status: 202 });
  }

  try {
    switch (method) {
      case "initialize":
        return ok(id, {
          protocolVersion: MCP_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "garimpa-vinil-mcp", version: "1.0.0" },
          instructions:
            "Garimpa Vinil tracks vinyl record prices on Amazon Brasil. " +
            "Use search_vinyl to find records by title/artist, get_deals for current promotions, " +
            "get_price_history for a specific album's price trend, and get_artist_albums for all " +
            "releases by an artist. All prices are in BRL (Brazilian Real).",
        });

      case "ping":
        return ok(id, {});

      case "tools/list":
        return ok(id, { tools: TOOLS });

      case "tools/call": {
        const toolName = typeof params.name === "string" ? params.name : null;
        const toolArgs = (params.arguments ?? {}) as Record<string, unknown>;

        if (!toolName) return rpcErr(id, -32602, "Missing required field: name");

        let result;
        switch (toolName) {
          case "search_vinyl":      result = await execSearchVinyl(toolArgs);      break;
          case "get_deals":         result = await execGetDeals(toolArgs);          break;
          case "get_price_history": result = await execGetPriceHistory(toolArgs);   break;
          case "get_artist_albums": result = await execGetArtistAlbums(toolArgs);   break;
          default: return rpcErr(id, -32601, `Unknown tool: "${toolName}"`);
        }

        return ok(id, result);
      }

      default:
        return rpcErr(id, -32601, `Method not found: "${method}"`);
    }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && "message" in e) {
      const typed = e as { code: number; message: string };
      return rpcErr(id, typed.code, typed.message);
    }
    console.error("[mcp] internal error for method=%s:", method, e);
    return rpcErr(id, -32603, "Internal error");
  }
}
