import { Ctx, mutateProduct, need } from "@/lib/route";
import { deleteImage, readImage, saveImage } from "@/lib/files";
import { buildCloseupPrompt, generateImage } from "@/lib/imagegen";

export const maxDuration = 120;

type P = Ctx<{ id: string; pinId: string }>;

/** Edit a pin's text or position. */
export async function PATCH(req: Request, { params }: P) {
  const { id, pinId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    note?: string;
    x?: number;
    y?: number;
  };
  return mutateProduct(id, (product) => {
    const pin = need(product.details?.find((p) => p.id === pinId), "Pin not found", 404);
    if (typeof body.title === "string") pin.title = body.title.slice(0, 120);
    if (typeof body.note === "string") pin.note = body.note.slice(0, 600);
    if (typeof body.x === "number") pin.x = Math.min(100, Math.max(0, body.x));
    if (typeof body.y === "number") pin.y = Math.min(100, Math.max(0, body.y));
  });
}

/** Make an AI close-up photo of the pinned detail. */
export async function POST(_req: Request, { params }: P) {
  const { id, pinId } = await params;
  return mutateProduct(id, async (product) => {
    const pin = need(product.details?.find((p) => p.id === pinId), "Pin not found", 404);
    const src = need(await readImage(id, pin.image), "The product image is missing.");
    const img = await generateImage(
      buildCloseupPrompt(pin.title, pin.note),
      [{ mime: src.mime, data: src.buffer }],
      "1024x1024",
      "Close-up",
    );
    if (pin.closeup) await deleteImage(id, pin.closeup);
    pin.closeup = await saveImage(id, "mockup", img.mime, img.data);
  });
}

export async function DELETE(_req: Request, { params }: P) {
  const { id, pinId } = await params;
  return mutateProduct(id, async (product) => {
    const pin = need(product.details?.find((p) => p.id === pinId), "Pin not found", 404);
    if (pin.closeup) await deleteImage(id, pin.closeup);
    product.details = product.details!.filter((p) => p.id !== pinId);
  });
}
