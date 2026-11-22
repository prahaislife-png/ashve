import "server-only";
import { randomUUID } from "crypto";
import { Brand, emptyBrand, emptyLabels, MeasureMeta, normalizeTechPack, Product, TechPack } from "./schema";
import { deleteProductImages } from "./files";
import { storage } from "./storage";

// Products and brand settings are JSON documents in `storage`
// (./data on your computer, a private Vercel Blob store online).
const BRAND_FILE = "brand.json";
const MAX_REVISIONS = 30;

async function readJson<T>(key: string): Promise<T | null> {
  const buf = await storage.read(key);
  return buf ? (JSON.parse(buf.toString("utf8")) as T) : null;
}

async function writeJson(key: string, value: unknown) {
  await storage.write(key, Buffer.from(JSON.stringify(value, null, 2), "utf8"), "application/json");
}

function productFile(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid product id");
  return `products/${id}.json`;
}

/* ---------- Brand ---------- */

export async function getBrand(): Promise<Brand> {
  const saved = await readJson<Partial<Brand>>(BRAND_FILE);
  return { ...emptyBrand, ...(saved ?? {}) };
}

export async function saveBrand(brand: Brand) {
  await writeJson(BRAND_FILE, brand);
}

/* ---------- Products ---------- */

export async function listProducts(): Promise<Product[]> {
  const keys = (await storage.list("products/")).filter((k) => k.endsWith(".json"));
  const items = await Promise.all(keys.map((k) => readJson<Product>(k)));
  return items
    .filter((p): p is Product => p !== null)
    .map((p) => ({ ...p, techPack: normalizeTechPack(p.techPack) }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProduct(id: string): Promise<Product | null> {
  const p = await readJson<Product>(productFile(id));
  if (!p) return null;
  p.techPack = normalizeTechPack(p.techPack);
  p.revisions = (p.revisions ?? []).map((r) => ({ ...r, techPack: normalizeTechPack(r.techPack)! }));
  p.mockups = p.mockups ?? [];
  p.flats = p.flats ?? [];
  p.details = p.details ?? [];
  p.prints = p.prints ?? [];
  p.labels = { ...emptyLabels, ...(p.labels ?? {}) };
  return p;
}

export async function createProduct(name: string, useBrand = true): Promise<Product> {
  const now = new Date().toISOString();
  const product: Product = {
    id: randomUUID(),
    name: name.trim() || "Untitled piece",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    techPack: null,
    messages: [],
    revisions: [],
    mockups: [],
    flats: [],
    details: [],
    prints: [],
    labels: structuredClone(emptyLabels),
    useBrand,
  };
  await writeJson(productFile(product.id), product);
  return product;
}

export async function saveProduct(product: Product): Promise<Product> {
  product.updatedAt = new Date().toISOString();
  await writeJson(productFile(product.id), product);
  return product;
}

/**
 * Replace the tech pack, keeping the old one in revision history.
 * Measurement trust: a row whose numbers didn't change keeps its tags (verified,
 * edited, graded). A row the AI changed goes back to "AI-suggested, not verified",
 * so she always knows which numbers still need checking.
 */
export function applyTechPack(product: Product, techPack: TechPack) {
  const old = product.techPack;
  if (old) {
    product.revisions.push({ at: new Date().toISOString(), techPack: old });
    product.revisions = product.revisions.slice(-MAX_REVISIONS);
  }
  const prevMeta = product.measureMeta ?? {};
  const meta: Record<string, MeasureMeta> = {};
  for (const m of techPack.measurements) {
    const before = old?.measurements.find((x) => x.code === m.code);
    const kept = prevMeta[m.code];
    const unchanged =
      before &&
      JSON.stringify(before.values) === JSON.stringify(m.values) &&
      before.toleranceCm === m.toleranceCm &&
      JSON.stringify(old?.sizes) === JSON.stringify(techPack.sizes);
    meta[m.code] = kept && unchanged ? kept : { source: "ai", verified: false, grade: kept?.grade ?? null };
  }
  product.measureMeta = meta;
  product.techPack = techPack;
}

export async function deleteProduct(id: string) {
  await storage.remove(productFile(id));
  await deleteProductImages(id);
}
