import { getProduct } from "@/lib/store";
import { readImage, sanitizeSvg } from "@/lib/files";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Coloured sketch: the current flat with the garment filled in a colourway.
 * GET ?side=front|back&hex=RRGGBB
 */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const url = new URL(req.url);
  const side = url.searchParams.get("side") === "back" ? "back" : "front";
  const hex = /^[0-9a-f]{6}$/i.test(url.searchParams.get("hex") ?? "")
    ? `#${url.searchParams.get("hex")}`
    : "#d8cfbf";

  const product = await getProduct(id).catch(() => null);
  const set = product?.flats?.at(-1);
  if (!set) return new Response("Not found", { status: 404 });
  const file = await readImage(id, set[side]);
  if (!file) return new Response("Not found", { status: 404 });

  let svg = file.buffer.toString("utf8");
  // The first <rect> is the white background: mark it so it stays white.
  svg = svg.replace(/<rect\b/i, '<rect data-bg="1"');
  // Fill every other white garment shape with the colourway.
  svg = svg.replace(
    /(<(?:path|polygon|rect|ellipse|circle|polyline)\b(?![^>]*data-bg)[^>]*?)fill\s*=\s*(["'])(?:#fff|#ffffff|white)\2/gi,
    `$1fill="${hex}"`,
  );
  svg = sanitizeSvg(svg) ?? "";

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
