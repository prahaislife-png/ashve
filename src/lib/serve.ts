import "server-only";
import { readImage, sanitizeSvg } from "./files";
import { Product } from "./schema";

const SAFE = {
  // Belt and braces for SVGs: never run scripts or load anything if opened directly.
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
  "X-Content-Type-Options": "nosniff",
};

/** Serve one stored image/drawing of a product. */
export async function serveFile(productId: string, name: string): Promise<Response> {
  let image;
  try {
    image = await readImage(productId, name);
  } catch {
    image = null;
  }
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.buffer), {
    headers: { "Content-Type": image.mime, "Cache-Control": "private, max-age=31536000, immutable", ...SAFE },
  });
}

/**
 * Coloured sketch: the current flat with the garment filled in a colourway.
 * Query: ?side=front|back&hex=RRGGBB
 */
export async function serveColoredFlat(product: Product | null, reqUrl: string): Promise<Response> {
  const url = new URL(reqUrl);
  const side = url.searchParams.get("side") === "back" ? "back" : "front";
  const hex = /^[0-9a-f]{6}$/i.test(url.searchParams.get("hex") ?? "") ? `#${url.searchParams.get("hex")}` : "#d8cfbf";
  const set = product?.flats?.at(-1);
  if (!product || !set) return new Response("Not found", { status: 404 });
  const file = await readImage(product.id, set[side]);
  if (!file) return new Response("Not found", { status: 404 });

  let svg = file.buffer.toString("utf8");
  // The first <rect> is the white background: mark it so it stays white.
  svg = svg.replace(/<rect\b/i, '<rect data-bg="1"');
  // Fill every other white garment shape with the colourway.
  svg = svg.replace(
    /(<(?:path|polygon|rect|ellipse|circle|polyline)\b(?![^>]*data-bg)[^>]*?)fill\s*=\s*(["'])(?:#fff|#ffffff|white)\2/gi,
    `$1fill="${hex}"`,
  );
  return new Response(sanitizeSvg(svg) ?? "", {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store", ...SAFE },
  });
}
