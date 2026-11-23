import "server-only";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { getBrand, getProduct, listProducts } from "./store";
import { Collection, Product } from "./schema";

/** Collections (drops) are JSON documents at collections/<id>.json. */

const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid collection id");
  return `collections/${id}.json`;
};

function normalize(c: Partial<Collection> & { id: string }): Collection {
  const now = new Date().toISOString();
  return {
    name: "Untitled collection",
    season: "",
    launchDate: null,
    story: "",
    status: "planning",
    moodboard: [],
    palette: [],
    fabrics: [],
    sizes: "",
    targetPieces: null,
    plan: [],
    share: null,
    createdAt: now,
    updatedAt: now,
    ...c,
  };
}

export async function getCollection(id: string): Promise<Collection | null> {
  let key: string;
  try {
    key = file(id);
  } catch {
    return null;
  }
  const buf = await storage.read(key);
  return buf ? normalize(JSON.parse(buf.toString("utf8"))) : null;
}

export async function saveCollection(c: Collection): Promise<Collection> {
  c.updatedAt = new Date().toISOString();
  await storage.write(file(c.id), Buffer.from(JSON.stringify(c, null, 2), "utf8"), "application/json");
  return c;
}

export async function listCollections(): Promise<Collection[]> {
  const keys = (await storage.list("collections/")).filter((k) => k.endsWith(".json"));
  const items = await Promise.all(keys.map((k) => storage.read(k)));
  return items
    .filter((b): b is Buffer => !!b)
    .map((b) => normalize(JSON.parse(b.toString("utf8"))))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createCollection(input: Partial<Collection>): Promise<Collection> {
  const brand = await getBrand();
  const c = normalize({
    ...input,
    id: randomUUID(),
    name: input.name?.trim() || "Untitled collection",
    // Start from the brand's palette and sizes; she edits them per collection.
    palette: input.palette ?? brand.palette.filter((p) => p.name || p.hex),
    sizes: input.sizes ?? brand.sizes,
  });
  return saveCollection(c);
}

export async function deleteCollection(id: string) {
  await storage.remove(file(id));
}

/** The products in a collection, in line-plan order (pieces not in the plan come last). */
export async function collectionProducts(c: Collection, all?: Product[]): Promise<Product[]> {
  const products = all ?? (await listProducts());
  const inCollection = products.filter((p) => p.collectionId === c.id);
  const order = new Map(c.plan.map((s, i) => [s.productId, i]));
  return inCollection.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
}

/** Text Claude gets when it works on a piece in a collection, so the pieces belong together. */
export async function collectionBrief(c: Collection, productId: string): Promise<string> {
  const siblings = (await collectionProducts(c)).filter((p) => p.id !== productId && p.techPack);
  const lines = [
    `COLLECTION: "${c.name}"${c.season ? `, ${c.season}` : ""}${c.launchDate ? `, launching ${c.launchDate}` : ""}.`,
    c.story && `Story and mood: ${c.story}`,
    c.palette.length && `Collection palette (use these colourways unless she asks otherwise): ${c.palette.map((p) => `${p.name}${p.pantone ? ` ${p.pantone}` : ""} ${p.hex}`).join("; ")}.`,
    c.fabrics.length &&
      `Collection fabric library (prefer these): ${c.fabrics
        .map((f) => `${f.name}: ${f.composition} ${f.construction}${f.weightGsm ? ` ${f.weightGsm} GSM` : ""}${f.supplier ? `, from ${f.supplier}` : ""}`)
        .join("; ")}.`,
    c.sizes && `Collection size range: ${c.sizes}.`,
    siblings.length &&
      `Other pieces already in this collection (keep sizes, fabrics, trims, labels and finishing consistent with them):\n${siblings
        .map((p) => {
          const t = p.techPack!;
          return `- ${t.styleName} (${t.styleNumber || "no style no."}): ${t.productType}; sizes ${t.sizes.join("/")}; colourways ${t.colorways.map((x) => x.name).join(", ")}; main fabric ${t.fabrics[0] ? `${t.fabrics[0].composition} ${t.fabrics[0].construction}` : "?"}`;
        })
        .join("\n")}`,
    "Give the style number the same pattern as the other pieces if they have one.",
  ];
  return lines.filter(Boolean).join("\n");
}

/** Everything Claude needs besides the tech pack: Brand DNA (if on), region and collection. */
export async function aiContext(product: Product) {
  const brand = await getBrand();
  const collection = product.collectionId ? await getCollection(product.collectionId) : null;
  return {
    brand: product.useBrand === false ? null : brand,
    region: { currency: brand.currency, vendorCountry: brand.vendorCountry },
    collection: collection ? await collectionBrief(collection, product.id) : null,
  };
}

export async function productsByIds(ids: string[]) {
  return (await Promise.all(ids.map((id) => getProduct(id).catch(() => null)))).filter((p): p is Product => !!p);
}
