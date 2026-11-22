import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");
const MAX_BYTES = 8 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(EXT_BY_MIME).map(([m, e]) => [e, m]),
);

export type ImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/svg+xml";

function productDir(productId: string) {
  if (!/^[a-f0-9-]{36}$/.test(productId)) throw new Error("Invalid product id");
  return path.join(UPLOADS_DIR, productId);
}

function filePath(productId: string, name: string) {
  if (!/^[a-z]+-[a-f0-9-]{36}\.(jpg|png|webp|svg)$/.test(name)) throw new Error("Invalid file name");
  return path.join(productDir(productId), name);
}

/** Parse a `data:image/...;base64,...` URL sent from the browser. */
export function parseDataUrl(dataUrl: string): { mime: ImageMime; buffer: Buffer } {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Only JPEG, PNG or WebP images are supported");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_BYTES) throw new Error("Image is too large (max 8 MB)");
  return { mime: match[1] as ImageMime, buffer };
}

export async function saveImage(
  productId: string,
  kind: "ref" | "mockup" | "flat",
  mime: string,
  buffer: Buffer,
): Promise<string> {
  const ext = EXT_BY_MIME[mime];
  if (!ext) throw new Error(`Unsupported image type ${mime}`);
  const name = `${kind}-${randomUUID()}.${ext}`;
  await fs.mkdir(productDir(productId), { recursive: true });
  await fs.writeFile(filePath(productId, name), buffer);
  return name;
}

/**
 * Clean an AI-written SVG so it can only draw: no scripts, event handlers,
 * embedded HTML or links to outside files. Returns null if it isn't a usable SVG.
 */
export function sanitizeSvg(raw: string): string | null {
  let svg = raw.trim();
  const start = svg.indexOf("<svg");
  const end = svg.lastIndexOf("</svg>");
  if (start === -1 || end === -1) return null;
  svg = svg.slice(start, end + 6);
  svg = svg
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script[^>]*\/>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/<(iframe|object|embed|image|use|a)\b[^>]*\/>/gi, "")
    .replace(/<(iframe|object|embed|image|a)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, "")
    .replace(/url\(\s*['"]?(?!#)[^)]*\)/gi, "none")
    .replace(/@import[^;]*;/gi, "");
  if (!/viewBox\s*=/.test(svg)) return null;
  if (!/xmlns\s*=/.test(svg)) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return svg;
}

export async function readImage(
  productId: string,
  name: string,
): Promise<{ buffer: Buffer; mime: ImageMime } | null> {
  try {
    const buffer = await fs.readFile(filePath(productId, name));
    const ext = name.split(".").pop()!;
    return { buffer, mime: MIME_BY_EXT[ext] as ImageMime };
  } catch {
    return null;
  }
}

export async function deleteImage(productId: string, name: string) {
  await fs.rm(filePath(productId, name), { force: true });
}

export async function deleteProductImages(productId: string) {
  await fs.rm(productDir(productId), { recursive: true, force: true });
}
