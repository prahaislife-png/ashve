import { Ctx, mutateProduct, need } from "@/lib/route";
import { getBrand } from "@/lib/store";
import { deleteImage, parseDataUrl, saveImage } from "@/lib/files";
import { buildLabelPrompt, generateImage } from "@/lib/imagegen";
import { emptyLabels } from "@/lib/schema";

export const maxDuration = 120;

type Slot = "product" | "hangTag";
const slotOf = (v: unknown): Slot => (v === "hangTag" ? "hangTag" : "product");

/**
 * Create a label or hang tag image.
 * { slot, mode: "ai", notes? } or { slot, mode: "upload", dataUrl }
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    slot?: string;
    mode?: string;
    dataUrl?: string;
    notes?: string;
  };
  return mutateProduct(id, async (product) => {
    const labels = (product.labels = { ...emptyLabels, ...(product.labels ?? {}) });
    const slot = slotOf(body.slot);
    const current = { ...labels[slot] };
    let file: string;
    if (body.mode === "upload") {
      const { mime, buffer } = parseDataUrl(need(body.dataUrl, "Choose an image file."));
      file = await saveImage(id, "mockup", mime, buffer);
      current.source = "upload";
    } else {
      const tp = need(product.techPack, "Create the tech pack first.");
      const brand = await getBrand();
      if (typeof body.notes === "string") current.notes = body.notes.slice(0, 500);
      const img = await generateImage(
        buildLabelPrompt({
          slot,
          brandName: brand.name,
          aesthetic: brand.aesthetic,
          care: tp.careInstructions,
          composition: tp.fabrics[0]?.composition ?? "",
          notes: [current.notes, brand.labelNotes].filter(Boolean).join(" "),
        }),
        [],
        "1536x1024",
      );
      file = await saveImage(id, "mockup", img.mime, img.data);
      current.source = "ai";
    }
    if (labels[slot].file) await deleteImage(id, labels[slot].file!);
    current.file = file;
    labels[slot] = current;
  });
}

/** Update position / notes, or remove the image ({ slot, remove: true }). */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    slot?: string;
    position?: string;
    notes?: string;
    remove?: boolean;
  };
  return mutateProduct(id, async (product) => {
    const labels = (product.labels = { ...emptyLabels, ...(product.labels ?? {}) });
    const slot = slotOf(body.slot);
    const s = { ...labels[slot] };
    if (typeof body.position === "string") s.position = body.position.slice(0, 80);
    if (typeof body.notes === "string") s.notes = body.notes.slice(0, 500);
    if (body.remove && s.file) {
      await deleteImage(id, s.file);
      s.file = null;
      s.source = null;
    }
    labels[slot] = s;
  });
}
