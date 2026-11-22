import "server-only";
import { NextResponse } from "next/server";
import { getProduct, saveProduct } from "./store";
import { AiError } from "./ai";
import { ImageGenError } from "./imagegen";
import { Product } from "./schema";

export type Ctx<P = { id: string }> = { params: Promise<P> };

export class UserError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/* ---------- per-product lock for the final read-merge-write ---------- */

const locks = new Map<string, Promise<unknown>>();

async function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => (release = r));
  const chained = prev.then(() => next);
  locks.set(id, chained);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(id) === chained) locks.delete(id);
  }
}

type WithId = { id: string };
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const isIdArray = (v: unknown): v is WithId[] =>
  Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object" && typeof (x as WithId).id === "string");

/**
 * Apply the changes a request made (before → after) on top of the latest saved
 * product, so two long-running requests on the same product don't overwrite each other.
 */
function mergeChanges(before: Product, after: Product, latest: Product): Product {
  const result: Record<string, unknown> = { ...latest };
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const b = (before as unknown as Record<string, unknown>)[key];
    const a = (after as unknown as Record<string, unknown>)[key];
    if (JSON.stringify(a) === JSON.stringify(b)) continue; // this request didn't touch it
    const l = (latest as unknown as Record<string, unknown>)[key];
    if ((isIdArray(a) || isIdArray(b)) && (Array.isArray(l) || l === undefined)) {
      const bMap = new Map(((b as WithId[]) ?? []).map((x) => [x.id, x]));
      const aMap = new Map(((a as WithId[]) ?? []).map((x) => [x.id, x]));
      const changed = (x: WithId) => JSON.stringify(x) !== JSON.stringify(bMap.get(x.id));
      const merged = ((l as WithId[]) ?? [])
        .filter((x) => !(bMap.has(x.id) && !aMap.has(x.id))) // removed by this request
        .map((x) => (aMap.has(x.id) && changed(aMap.get(x.id)!) ? aMap.get(x.id)! : x));
      const latestIds = new Set(merged.map((x) => x.id));
      // Keep this request's order for the items it added or reordered (e.g. "use this flat set").
      const added = ((a as WithId[]) ?? []).filter((x) => !bMap.has(x.id) && !latestIds.has(x.id));
      const reordered = ((a as WithId[]) ?? []).map((x) => x.id).join() !== ((b as WithId[]) ?? []).map((x) => x.id).join();
      if (reordered && added.length === 0 && merged.length === (a as WithId[]).length) {
        result[key] = (a as WithId[]).map((x) => merged.find((m) => m.id === x.id) ?? x);
      } else {
        result[key] = [...merged, ...added];
      }
    } else if (isPlainObject(a) && isPlainObject(b) && isPlainObject(l) && key !== "techPack") {
      // e.g. labels: { product, hangTag } — keep sub-keys other requests changed
      const merged: Record<string, unknown> = { ...l };
      for (const sub of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (JSON.stringify(a[sub]) !== JSON.stringify(b[sub])) merged[sub] = a[sub];
      }
      result[key] = merged;
    } else {
      result[key] = a;
    }
  }
  return result as unknown as Product;
}

/**
 * Load a product, run `fn` (which may change it, and may take minutes for AI work),
 * then merge its changes into the latest saved copy and return it as JSON.
 */
export async function mutateProduct(
  id: string,
  fn: (p: Product) => Promise<void> | void,
): Promise<NextResponse> {
  try {
    const product = await getProduct(id);
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const before = structuredClone(product);
    await fn(product);
    const saved = await withLock(id, async () => {
      const latest = (await getProduct(id)) ?? before;
      return saveProduct(mergeChanges(before, product, latest));
    });
    return NextResponse.json(saved);
  } catch (error) {
    return errorResponse(error);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof UserError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof AiError || error instanceof ImageGenError) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  console.error(error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export function need<T>(value: T | null | undefined, message: string, status = 400): T {
  if (value === null || value === undefined) throw new UserError(message, status);
  return value;
}
