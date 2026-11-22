import { randomUUID } from "crypto";
import { Ctx, mutateProduct, need } from "@/lib/route";
import { deleteImage, readImage, saveImage } from "@/lib/files";
import { buildEditPrompt, generateImage } from "@/lib/imagegen";

export const maxDuration = 120;

type P = Ctx<{ id: string; mockupId: string }>;

/** Edit an existing mockup with an instruction. Saves the result as a new image. */
export async function POST(req: Request, { params }: P) {
  const { id, mockupId } = await params;
  const { instruction } = (await req.json().catch(() => ({}))) as { instruction?: string };
  const text = String(instruction ?? "").trim().slice(0, 500);

  return mutateProduct(id, async (product) => {
    const mockup = need(product.mockups?.find((m) => m.id === mockupId), "Image not found", 404);
    need(text || null, "Say what to change.");
    const source = need(await readImage(id, mockup.file), "Original image is missing.", 404);
    const image = await generateImage(
      buildEditPrompt(text),
      [{ mime: source.mime, data: source.buffer }],
      undefined,
      "Mockup edit",
    );
    const file = await saveImage(id, "mockup", image.mime, image.data);
    product.mockups = [
      ...(product.mockups ?? []),
      {
        id: randomUUID(),
        file,
        view: mockup.view,
        colorway: mockup.colorway,
        note: text,
        editedFrom: mockup.id,
        inPdf: mockup.inPdf,
        at: new Date().toISOString(),
      },
    ];
  });
}

/** Toggle whether the image appears in the PDF. */
export async function PATCH(req: Request, { params }: P) {
  const { id, mockupId } = await params;
  const { inPdf } = (await req.json().catch(() => ({}))) as { inPdf?: boolean };
  return mutateProduct(id, (product) => {
    const mockup = need(product.mockups?.find((m) => m.id === mockupId), "Image not found", 404);
    if (typeof inPdf === "boolean") mockup.inPdf = inPdf;
  });
}

export async function DELETE(_req: Request, { params }: P) {
  const { id, mockupId } = await params;
  return mutateProduct(id, async (product) => {
    const mockup = need(product.mockups?.find((m) => m.id === mockupId), "Image not found", 404);
    product.mockups = product.mockups!.filter((m) => m.id !== mockupId);
    product.details = (product.details ?? []).filter((d) => d.image !== mockup.file);
    await deleteImage(id, mockup.file);
  });
}
