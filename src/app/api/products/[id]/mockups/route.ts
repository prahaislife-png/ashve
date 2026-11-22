import { randomUUID } from "crypto";
import { Ctx, mutateProduct, need } from "@/lib/route";
import { getBrand } from "@/lib/store";
import { readImage, saveImage } from "@/lib/files";
import { buildMockupPrompt, generateImage } from "@/lib/imagegen";
import { MOCKUP_VIEWS, MockupView } from "@/lib/schema";

export const maxDuration = 120;

/** Create a new mockup from the current tech pack. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    view?: string;
    colorway?: string;
    note?: string;
    useReferences?: boolean;
  };

  return mutateProduct(id, async (product) => {
    const tp = need(product.techPack, "Create the tech pack first.");
    const view = (body.view && body.view in MOCKUP_VIEWS ? body.view : "flat-front") as MockupView;
    const names = tp.colorways.map((c) => c.name);
    const colorway = body.colorway && names.includes(body.colorway) ? body.colorway : (names[0] ?? "");
    const note = String(body.note ?? "").trim().slice(0, 500);

    // The 3 most recent reference photos from the chat.
    const refNames = body.useReferences ? product.messages.flatMap((m) => m.images ?? []).slice(-3) : [];
    const refs = (await Promise.all(refNames.map((n) => readImage(id, n))))
      .filter((r) => r !== null)
      .map((r) => ({ mime: r.mime, data: r.buffer }));

    const prompt = buildMockupPrompt({
      techPack: tp,
      brand: await getBrand(),
      view,
      colorway,
      note,
      hasReferences: refs.length > 0,
    });
    const image = await generateImage(prompt, refs, undefined, "Mockup");
    const file = await saveImage(id, "mockup", image.mime, image.data);
    product.mockups = [
      ...(product.mockups ?? []),
      { id: randomUUID(), file, view, colorway, note, editedFrom: null, inPdf: true, at: new Date().toISOString() },
    ];
  });
}
