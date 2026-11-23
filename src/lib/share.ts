import "server-only";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import { getProduct } from "./store";
import { Product } from "./schema";

/**
 * Read-only factory links. A random token maps to a product via shares/<token>.json.
 * Turning the link off deletes that file, so the old link stops working at once.
 */

const key = (token: string) => {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) throw new Error("Invalid token");
  return `shares/${token}.json`;
};

export function newToken() {
  return randomBytes(24).toString("base64url"); // 32 characters
}

export async function saveShare(token: string, productId: string) {
  await storage.write(key(token), Buffer.from(JSON.stringify({ productId, createdAt: new Date().toISOString() })), "application/json");
}

export async function removeShare(token: string) {
  try {
    await storage.remove(key(token));
  } catch {
    // already gone or malformed
  }
}

/** The product behind a factory link, or null if the link is unknown or was turned off. */
export async function productForToken(token: string): Promise<Product | null> {
  let k: string;
  try {
    k = key(token);
  } catch {
    return null;
  }
  const buf = await storage.read(k);
  if (!buf) return null;
  const { productId } = JSON.parse(buf.toString("utf8")) as { productId: string };
  const product = await getProduct(productId).catch(() => null);
  // Double check the product still points at this token.
  return product?.share?.token === token && product.techPack ? product : null;
}

/* ---------- collection links (one link for a whole drop) ---------- */

export async function saveCollectionShare(token: string, collectionId: string) {
  await storage.write(key(token), Buffer.from(JSON.stringify({ collectionId, createdAt: new Date().toISOString() })), "application/json");
}

/** The collection behind a vendor link, or null. */
export async function collectionIdForToken(token: string): Promise<string | null> {
  let k: string;
  try {
    k = key(token);
  } catch {
    return null;
  }
  const buf = await storage.read(k);
  if (!buf) return null;
  const { collectionId } = JSON.parse(buf.toString("utf8")) as { collectionId?: string };
  return collectionId ?? null;
}
