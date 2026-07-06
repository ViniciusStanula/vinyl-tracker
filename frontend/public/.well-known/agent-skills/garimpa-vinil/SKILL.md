---
name: garimpa-vinil
description: Query vinyl record prices, deals, price history, and artist catalogs on Amazon Brasil via the Garimpa Vinil MCP server. All data public, no authentication required.
---

# Garimpa Vinil — Vinyl Price Data

Garimpa Vinil tracks vinyl record prices on Amazon Brasil: 11,000+ titles, prices checked multiple times daily, deals scored against a rolling 30-day history. All prices in BRL.

## Endpoint

MCP server (JSON-RPC 2.0 over HTTP POST):

```
POST https://www.garimpavinil.com.br/api/mcp
Content-Type: application/json
```

No authentication. Rate limit: 30 requests per IP per minute. Protocol: Model Context Protocol 2024-11-05.

The same tools are exposed in-page via WebMCP (`document.modelContext`) for browser-based agents.

## Tools

### search_vinyl
Full-text search by album title or artist name. Optional: `preco_max` (max price BRL), `sort` (`desconto` | `menor-preco` | `maior-preco` | `deals` | `az`), `pagina` (24 results/page).

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_vinyl","arguments":{"query":"pink floyd","preco_max":200}}}
```

### get_deals
Current best deals. Optional: `genero` (e.g. rock, jazz, mpb), `preco_max`, `limite` (1–24, default 10). Sorted by deal tier then discount.

### get_price_history
Full price history for one record by `slug` (required, from search results): current price, 30-day average, all-time low/high, up to 1 year of timestamped points.

### get_artist_albums
All records by artist via `artista_slug` (required; lowercase, accents stripped, hyphens — e.g. `the-beatles`, `rita-lee`). Optional: `preco_max`, `sort`.

## Deal scores

- 3 = "Melhor Preço" — at or below all-time low
- 2 = "Ótima Oferta" — significantly below 30-day average
- 1 = "Boa Oferta" — below 30-day average
- null = no active deal

## Response format

Tool results return `content[0].text` containing pretty-printed JSON with fields: `slug`, `titulo`, `artista`, `generos`, `preco_atual_brl`, `media_30d_brl`, `desconto_pct`, `deal_score`, `deal_label`, `avaliacao_amazon`, `url_garimpa`, `url_amazon`.

More context: https://www.garimpavinil.com.br/llms.txt
