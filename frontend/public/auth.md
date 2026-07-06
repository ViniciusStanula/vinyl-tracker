# Agent Authentication — Garimpa Vinil

**No authentication required.** All Garimpa Vinil data is publicly readable.

## For AI agents

- MCP server: `POST https://www.garimpavinil.com.br/api/mcp` (JSON-RPC 2.0, no API key, no registration)
- Rate limit: 30 requests per IP per minute (HTTP 429 with `Retry-After` when exceeded)
- Tool catalog: [/.well-known/agent-skills/index.json](https://www.garimpavinil.com.br/.well-known/agent-skills/index.json)
- Site overview: [/llms.txt](https://www.garimpavinil.com.br/llms.txt)

There are no protected APIs, no OAuth endpoints, and no agent registration flow. If a future write API (e.g. price alerts for agents) introduces authentication, this file and `/.well-known/oauth-protected-resource` will document it.

## Contact

Questions or higher rate-limit needs: https://t.me/garimpavinil
