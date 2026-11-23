import { Ctx as BaseCtx, mutateProduct, need, UserError } from "@/lib/route";
import { deleteImage, parseDataUrl, saveImage } from "@/lib/files";

type Ctx = BaseCtx<{ id: string; roundId: string }>;

/** Add photos of the physical sample. Body: { images: dataUrl[] } */
export async function POST(req: Request, { params }: Ctx) {
  const { id, roundId } = await params;
  const { images } = (await req.json().catch(() => ({}))) as { images?: string[] };
  return mutateProduct(id, async (product) => {
    const round = need(product.samples?.find((r) => r.id === roundId), "Sample round not found", 404);
    const list = Array.isArray(images) ? images.slice(0, 12) : [];
    if (!list.length) throw new UserError("Choose at least one photo.");
    if (round.photos.length + list.length > 24) throw new UserError("A round can hold up to 24 photos.");
    for (const dataUrl of list) {
      let parsed;
      try {
        parsed = parseDataUrl(dataUrl);
      } catch (e) {
        throw new UserError((e as Error).message);
      }
      const file = await saveImage(id, "sample", parsed.mime, parsed.buffer);
      round.photos = [...round.photos, { file, caption: "" }];
    }
    if (round.status === "requested") {
      round.status = "received";
      round.receivedAt ??= new Date().toISOString();
    }
  });
}

/** Remove one photo. ?file=sample-....jpg */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id, roundId } = await params;
  const file = new URL(req.url).searchParams.get("file") ?? "";
  return mutateProduct(id, async (product) => {
    const round = need(product.samples?.find((r) => r.id === roundId), "Sample round not found", 404);
    if (!round.photos.some((p) => p.file === file)) return;
    round.photos = round.photos.filter((p) => p.file !== file);
    round.comments = round.comments.map((c) => (c.photo === file ? { ...c, photo: null } : c));
    await deleteImage(id, file).catch(() => {});
  });
}
