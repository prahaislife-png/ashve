import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "crypto";
import { storage } from "./storage";

/**
 * Usage tracking: every Claude and OpenAI call records its cost here, worked out
 * from the token counts each API returns and the published list prices.
 * One ledger file per month: usage/YYYY-MM.json
 */

export type UsageEvent = {
  id: string;
  at: string;
  provider: "claude" | "openai";
  model: string;
  kind: string;
  productId: string | null;
  productName: string | null;
  costUsd: number;
  tokens: { input: number; output: number; cached: number };
};

/* ---------- prices (USD per 1M tokens) ---------- */

type ClaudePrice = { in: number; out: number; cacheRead: number; cacheWrite: number };
const CLAUDE: Record<string, ClaudePrice> = {
  "claude-opus-5-5": { in: 4, out: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-opus-5": { in: 5, out: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { in: 5, out: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-5-5": { in: 2, out: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  "claude-fable-5-2": { in: 8, out: 40, cacheRead: 0.2, cacheWrite: 10 },
};

// gpt-image-2: text input $5, image input $8, cached image input $2, image output $30
const OPENAI_IMAGE = { textIn: 5, imageIn: 8, cachedIn: 2, out: 30 };

type ClaudeUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

export function claudeCost(model: string, u: ClaudeUsage) {
  const p = CLAUDE[model] ?? CLAUDE[Object.keys(CLAUDE).find((k) => model.startsWith(k)) ?? ""] ?? CLAUDE["claude-opus-5-5"];
  const cached = u.cache_read_input_tokens ?? 0;
  const written = u.cache_creation_input_tokens ?? 0;
  const cost =
    (u.input_tokens * p.in + u.output_tokens * p.out + cached * p.cacheRead + written * p.cacheWrite) / 1_000_000;
  return { cost, tokens: { input: u.input_tokens + written, output: u.output_tokens, cached } };
}

export type OpenAIImageUsage = {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { text_tokens?: number; image_tokens?: number; cached_tokens?: number };
};

export function openaiImageCost(u: OpenAIImageUsage | undefined) {
  const input = u?.input_tokens ?? 0;
  const output = u?.output_tokens ?? 0;
  const text = u?.input_tokens_details?.text_tokens ?? input;
  const image = u?.input_tokens_details?.image_tokens ?? 0;
  const cached = u?.input_tokens_details?.cached_tokens ?? 0;
  const cost =
    (text * OPENAI_IMAGE.textIn + Math.max(0, image - cached) * OPENAI_IMAGE.imageIn + cached * OPENAI_IMAGE.cachedIn + output * OPENAI_IMAGE.out) /
    1_000_000;
  return { cost, tokens: { input, output, cached } };
}

/* ---------- which product is this call for? ---------- */

const context = new AsyncLocalStorage<{ productId: string | null; productName: string | null }>();

export function withUsageContext<T>(productId: string | null, productName: string | null, fn: () => T): T {
  return context.run({ productId, productName }, fn);
}

/* ---------- ledger ---------- */

const monthKey = (d = new Date()) => `usage/${d.toISOString().slice(0, 7)}.json`;

let chain: Promise<unknown> = Promise.resolve();

/** Append one event. Never throws: a failed write must not break the AI action. */
export async function recordUsage(e: Omit<UsageEvent, "id" | "at" | "productId" | "productName">) {
  const ctx = context.getStore();
  const event: UsageEvent = {
    id: randomUUID(),
    at: new Date().toISOString(),
    productId: ctx?.productId ?? null,
    productName: ctx?.productName ?? null,
    ...e,
    costUsd: Math.round(e.costUsd * 1_000_000) / 1_000_000,
  };
  const job = chain.then(async () => {
    const key = monthKey();
    const buf = await storage.read(key);
    const events: UsageEvent[] = buf ? JSON.parse(buf.toString("utf8")) : [];
    events.push(event);
    await storage.write(key, Buffer.from(JSON.stringify(events), "utf8"), "application/json");
  });
  chain = job.catch(() => {});
  try {
    await job;
  } catch (err) {
    console.error("[usage] could not record", err);
  }
}

export async function readMonth(month = new Date().toISOString().slice(0, 7)): Promise<UsageEvent[]> {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  const buf = await storage.read(`usage/${month}.json`);
  return buf ? (JSON.parse(buf.toString("utf8")) as UsageEvent[]) : [];
}
