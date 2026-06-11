export type BotCategory =
  | "search"
  | "ai_training"
  | "ai_assistant"
  | "seo_tool"
  | "social"
  | "mcp_client"
  | "other";

export interface BotDef {
  name: string; // canonical name stored in bot_hits.bot_name
  pattern: string; // lowercase substring matched against the User-Agent
  category: BotCategory;
}

// Order matters: more specific patterns must come before their prefixes
// (e.g. "googlebot-image" before "googlebot", "applebot-extended" before "applebot").
export const BOTS: BotDef[] = [
  // Google
  { name: "Googlebot-Image", pattern: "googlebot-image", category: "search" },
  { name: "Googlebot", pattern: "googlebot", category: "search" },
  { name: "Google-Extended", pattern: "google-extended", category: "ai_training" },
  { name: "GoogleOther", pattern: "googleother", category: "search" },
  // Microsoft
  { name: "Bingbot", pattern: "bingbot", category: "search" },
  // OpenAI
  { name: "OAI-SearchBot", pattern: "oai-searchbot", category: "ai_assistant" },
  { name: "ChatGPT-User", pattern: "chatgpt-user", category: "ai_assistant" },
  { name: "GPTBot", pattern: "gptbot", category: "ai_training" },
  // Anthropic
  { name: "Claude-SearchBot", pattern: "claude-searchbot", category: "ai_assistant" },
  { name: "Claude-User", pattern: "claude-user", category: "ai_assistant" },
  { name: "ClaudeBot", pattern: "claudebot", category: "ai_training" },
  { name: "anthropic-ai", pattern: "anthropic-ai", category: "ai_training" },
  // Perplexity
  { name: "Perplexity-User", pattern: "perplexity-user", category: "ai_assistant" },
  { name: "PerplexityBot", pattern: "perplexitybot", category: "ai_assistant" },
  // Others
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
];

export function detectBot(userAgent: string): BotDef | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  for (const bot of BOTS) {
    if (ua.includes(bot.pattern)) return bot;
  }
  return null;
}
