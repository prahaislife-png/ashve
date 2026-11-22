import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Brand, emptyBrand, emptyLabels, normalizeTechPack, Product, TechPack } from "./schema";
import { deleteProductImages } from "./files";

// Everything is saved as plain JSON files in ./data so nothing needs an account.
// (Swap this file for Supabase later when the app goes online.)
const DATA_DIR = path.join(process.cwd(), "data");
const PRODUCTS_DIR = path.join(DATA_DIR, "products");
const BRAND_FILE = path.join(DATA_DIR, "brand.json");
const MAX_REVISIONS = 30;

async function ensureDirs() {
  await fs.mkdir(PRODUCTS_DIR, { recursive: true });
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function writeJson(file: string, value: unknown) {
  await ensureDirs();
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tmp, file);
}

function productFile(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid product id");
  return path.join(PRODUCTS_DIR, `${id}.json`);
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
  await ensureDirs();
  const files = (await fs.readdir(PRODUCTS_DIR)).filter((f) => f.endsWith(".json"));
  const items = await Promise.all(
    files.map((f) => readJson<Product>(path.join(PRODUCTS_DIR, f))),
  );
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

/** Replace the tech pack, keeping the old one in revision history. */
export function applyTechPack(product: Product, techPack: TechPack) {
  if (product.techPack) {
    product.revisions.push({ at: new Date().toISOString(), techPack: product.techPack });
    product.revisions = product.revisions.slice(-MAX_REVISIONS);
  }
  product.techPack = techPack;
}

export async function deleteProduct(id: string) {
  await fs.rm(productFile(id), { force: true });
  await deleteProductImages(id);
}
