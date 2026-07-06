"use client";

import { useEffect } from "react";

/**
 * WebMCP bridge — exposes the site's MCP tools to in-browser AI agents via
 * the proposed Web standard (Chrome 149+ origin trial, `document.modelContext`).
 * https://developer.chrome.com/docs/ai/webmcp
 *
 * Tools are fetched from /api/mcp (tools/list) and each execute() proxies a
 * same-origin tools/call, so the JSON-RPC route stays the single source of truth.
 */

interface ModelContextTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (args: Record<string, unknown>) => Promise<string>;
}

interface ModelContext {
  registerTool: (
    tool: ModelContextTool,
    options?: { signal?: AbortSignal },
  ) => Promise<void> | void;
}

async function rpc(method: string, params?: Record<string, unknown>) {
  const res = await fetch("/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

export default function WebMcpTools() {
  useEffect(() => {
    // document.modelContext since Chrome 150; navigator.modelContext before that
    const ctx = ((document as unknown as { modelContext?: ModelContext }).modelContext ??
      (navigator as unknown as { modelContext?: ModelContext }).modelContext);
    if (!ctx?.registerTool) return;

    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      const { tools } = (await rpc("tools/list")) as {
        tools: { name: string; description: string; inputSchema: Record<string, unknown> }[];
      };

      for (const tool of tools) {
        if (cancelled) return;
        await ctx.registerTool(
          {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: { readOnlyHint: true },
            execute: async (args) => {
              const result = (await rpc("tools/call", { name: tool.name, arguments: args })) as {
                content?: { type: string; text?: string }[];
              };
              return result.content?.[0]?.text ?? JSON.stringify(result);
            },
          },
          { signal: controller.signal },
        );
      }
    })().catch((e) => console.warn("[webmcp] tool registration failed:", e));

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return null;
}
