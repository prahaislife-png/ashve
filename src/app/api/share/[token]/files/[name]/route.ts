import { productForToken } from "@/lib/share";
import { serveFile } from "@/lib/serve";

type Ctx = { params: Promise<{ token: string; name: string }> };

/** Files for a factory link. Only files this product actually uses are served. */
export async function GET(_req: Request, { params }: Ctx) {
  const { token, name } = await params;
  const product = await productForToken(token);
  if (!product) return new Response("This link is no longer active.", { status: 404 });
  const used = new Set<string>([
    ...(product.mockups ?? []).map((m) => m.file),
    ...(product.flats ?? []).flatMap((f) => [f.front, f.back, f.measurementGuide, f.technical ?? ""]),
    ...(product.details ?? []).flatMap((d) => [d.image, d.closeup ?? ""]),
    ...(product.prints ?? []).map((p) => p.file),
    product.labels?.product.file ?? "",
    product.labels?.hangTag.file ?? "",
    ...product.messages.flatMap((m) => m.images ?? []),
    ...(product.samples ?? []).flatMap((r) => r.photos.map((ph) => ph.file)),
  ]);
  if (!used.has(name)) return new Response("Not found", { status: 404 });
  return serveFile(product.id, name);
}
