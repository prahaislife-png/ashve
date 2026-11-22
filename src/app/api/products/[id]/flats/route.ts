import { randomUUID } from "crypto";
import { Ctx, mutateProduct, need, UserError } from "@/lib/route";
import { deleteImage, readImage, sanitizeSvg, saveImage } from "@/lib/files";
import { drawFlats } from "@/lib/ai";

export const maxDuration = 300;

/** Draw (or redraw) the technical flats from the current tech pack. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { instruction } = (await req.json().catch(() => ({}))) as { instruction?: string };
  const text = String(instruction ?? "").trim().slice(0, 1000);

  return mutateProduct(id, async (product) => {
    const tp = need(product.techPack, "Create the tech pack first.");

    // Revise the current set when there is one.
    const current = product.flats?.at(-1);
    let previous: { front: string; back: string } | null = null;
    if (current) {
      const [f, b] = await Promise.all([readImage(id, current.front), readImage(id, current.back)]);
      if (f && b) previous = { front: f.buffer.toString("utf8"), back: b.buffer.toString("utf8") };
    }

    // Let Claude look at the front product view (or latest PDF mockup) and up to 2 reference photos.
    const view = product.mockups?.filter((m) => m.view === "product-front").at(-1)?.file;
    const mockup = view ?? (product.mockups ?? []).filter((m) => m.inPdf).at(-1)?.file;
    const refs = product.messages.flatMap((m) => m.images ?? []).slice(-2);
    const referenceImages = [...refs, ...(mockup ? [mockup] : [])];

    const drawing = await drawFlats({ productId: id, techPack: tp, instruction: text, previous, referenceImages });
    const svgs = [drawing.front, drawing.back, drawing.measurementGuide].map(sanitizeSvg);
    if (svgs.some((s) => s === null)) throw new UserError("Claude's drawing wasn't a valid SVG. Please try again.", 502);

    const saved: string[] = [];
    try {
      for (const svg of svgs as string[]) {
        saved.push(await saveImage(id, "flat", "image/svg+xml", Buffer.from(svg, "utf8")));
      }
    } catch (error) {
      await Promise.all(saved.map((n) => deleteImage(id, n)));
      throw error;
    }

    product.flats = [
      ...(product.flats ?? []),
      {
        id: randomUUID(),
        front: saved[0],
        back: saved[1],
        measurementGuide: saved[2],
        technical: null,
        technicalNotes: [],
        note: drawing.notes,
        at: new Date().toISOString(),
      },
    ];
  });
}
