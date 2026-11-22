import { Ctx, mutateProduct, need, UserError } from "@/lib/route";
import { readImage, sanitizeSvg, saveImage, deleteImage } from "@/lib/files";
import { drawTechnicalSketch } from "@/lib/ai";

export const maxDuration = 300;

/** Add a technical sketch (numbered construction callouts) to the current flat set. */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return mutateProduct(id, async (product) => {
    const tp = need(product.techPack, "Create the tech pack first.");
    const set = need(product.flats?.at(-1), "Draw the flat sketches first.");
    const front = need(await readImage(id, set.front), "The front flat file is missing.");

    const sketch = await drawTechnicalSketch({ techPack: tp, frontSvg: front.buffer.toString("utf8") });
    const svg = sanitizeSvg(sketch.svg);
    if (!svg) throw new UserError("Claude's technical sketch wasn't a valid SVG. Please try again.", 502);

    if (set.technical) await deleteImage(id, set.technical);
    set.technical = await saveImage(id, "flat", "image/svg+xml", Buffer.from(svg, "utf8"));
    set.technicalNotes = sketch.callouts;
  });
}
