import { NextResponse } from "next/server";

import { SITE_URL as SITE } from "@/lib/siteUrl";

function content() {
  return `# Garimpa Vinil

> Rastreador de preços de discos de vinil na Amazon Brasil. Monitora mais de 11.000 títulos com alertas de promoções e histórico de preços.

Garimpa Vinil is a price tracker for vinyl records sold on Amazon Brasil. An automated crawler checks prices multiple times daily and scores deals against a rolling 30-day price history. Data is publicly readable — no authentication required.

## MCP Server

AI agents can query Garimpa Vinil data via a JSON-RPC 2.0 MCP server.

Endpoint: ${SITE}/api/mcp (HTTP POST, Content-Type: application/json)
Protocol: Model Context Protocol 2024-11-05

Available tools:
- search_vinyl: full-text search across 11,000+ records by title or artist; supports price filter and sort
- get_deals: current best deals sorted by deal tier (Melhor Preço > Ótima Oferta > Boa Oferta) then by discount %; optional genre and price filter
- get_price_history: full 1-year price history for one record — current price, 30-day average, all-time low, timestamped price points
- get_artist_albums: all records by an artist with current prices and deal scores

The same four tools are also exposed in-page via WebMCP (document.modelContext) for browser-based agents.

Agent discovery:
- API catalog (RFC 9727): ${SITE}/.well-known/api-catalog
- Agent skills index: ${SITE}/.well-known/agent-skills/index.json
- Authentication: none required — see ${SITE}/auth.md

## Deal Scoring

deal_score field:
- 3 = "Melhor Preço" — current price is at or below all-time low
- 2 = "Ótima Oferta" — significantly below 30-day average
- 1 = "Boa Oferta" — below 30-day average
- null = no active deal

## Key Pages

- [Home — current deals](${SITE}/)
- [Browse all vinyl](${SITE}/disco)
- [Best deals under R$200](${SITE}/discos-abaixo-de-200)
- [Top listened artists](${SITE}/artistas-mais-ouvidos)
- [Sitemap index](${SITE}/sitemap.xml)

## Guias Editoriais

Long-form editorial guides about vinyl records in Brazilian Portuguese:

- [Como Cuidar de Discos de Vinil](${SITE}/guias/como-cuidar-de-discos-de-vinil) — Guia completo de limpeza, armazenamento no clima do Brasil, cuidados com agulha, os 5 erros que destroem coleções e checklist de manutenção diária/mensal/anual. ~4.000 palavras. Publicado 2026-05-27.
- [Como Avaliar o Estado de um Disco de Vinil](${SITE}/guias/como-avaliar-estado-disco-vinil) — Guia de gradação (Mint a Poor) com inspeção visual, teste de audição e checklist para comprar discos usados sem erro.
- [Vinil Colorido e Picture Disc Valem a Pena?](${SITE}/guias/vinil-colorido-e-picture-disc) — Diferenças de qualidade sonora entre vinil preto, colorido e picture disc, e quando cada um vale a compra.
- [Vinil 180g Vale a Pena?](${SITE}/guias/vinil-180g-vale-a-pena) — O que o peso do disco realmente muda em som, durabilidade e preço — mitos e fatos sobre prensagens de 180 gramas.
- [Melhores Discos de Rock por Subgênero](${SITE}/guias/rock) — Ranking Bayesiano de álbuns de rock por subgênero (18 subgêneros) baseado em avaliações Discogs de mais de 11.000 álbuns de 1.000+ artistas.
- [Top Artistas do Spotify por País](${SITE}/guias/top-artistas-spotify) — Ranking diário dos 10 artistas mais ouvidos no Spotify em 20 países. Atualizado às 8h UTC.

Full article text available at: ${SITE}/llms-full.txt

## Data Fields

Each record includes: slug (URL identifier), titulo (album name), artista (artist name), generos (Last.fm genre tags array), preco_atual_brl (current price in BRL), media_30d_brl (30-day average price in BRL), desconto_pct (discount % vs 30-day average), deal_score (1–3 or null), avaliacao_amazon (Amazon star rating), url_garimpa (page on this site), url_amazon (Amazon product link).

Prices are from Amazon Brasil (amazon.com.br). Currency is BRL (Brazilian Real).
`.trim();
}

export const revalidate = 3600;

export function GET() {
  return new NextResponse(content(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
