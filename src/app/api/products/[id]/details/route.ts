import { randomUUID } from "crypto";
import { Ctx, mutateProduct, need } from "@/lib/route";
import { suggestDetails } from "@/lib/ai";
import { productViews } from "@/lib/schema";

export const maxDuration = 300;

/**
 * Detail pins on a product image.
 * { action: "suggest" }  → Claude finds the key details on the front view
 * { action: "add", image, x, y, title, note } → add a pin by hand
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    image?: string;
    x?: number;
    y?: number;
    title?: string;
    note?: string;
  };

  return mutateProduct(id, async (product) => {
    const pins = (product.details = product.details ?? []);
    const nextN = () => (pins.reduce((m, p) => Math.max(m, p.n), 0) || 0) + 1;
    const clamp = (v: unknown) => Math.min(100, Math.max(0, Number(v) || 0));

    if (body.action === "suggest") {
      const tp = need(product.techPack, "Create the tech pack first.");
      const views = productViews(product);
      const image = body.image ?? views["product-front"]?.file;
      need(image, "Make the product views first (Design step).");
      const result = await suggestDetails({ productId: id, techPack: tp, image: image! });
      for (const d of result.details) {
        pins.push({
          id: randomUUID(),
          n: nextN(),
          image: image!,
          x: clamp(d.x),
          y: clamp(d.y),
          title: d.title.slice(0, 120),
          note: d.note.slice(0, 600),
          closeup: null,
          at: new Date().toISOString(),
        });
      }
      return;
    }

    const image = need(body.image, "Pick an image to pin on.");
    need(
      product.mockups?.find((m) => m.file === image),
      "That image doesn't belong to this product.",
    );
    pins.push({
      id: randomUUID(),
      n: nextN(),
      image,
      x: clamp(body.x),
      y: clamp(body.y),
      title: String(body.title ?? "New detail").slice(0, 120),
      note: String(body.note ?? "").slice(0, 600),
      closeup: null,
      at: new Date().toISOString(),
    });
  });
}
