import { Ctx, mutateProduct, UserError } from "@/lib/route";
import { applyTechPack, getBrand } from "@/lib/store";
import { runTechPackTurn } from "@/lib/ai";
import { deleteImage, parseDataUrl, saveImage } from "@/lib/files";

export const maxDuration = 300;

const MAX_PHOTOS = 4;

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { message, images } = (await req.json().catch(() => ({}))) as { message?: string; images?: string[] };
  const text = String(message ?? "").trim();
  const photos = Array.isArray(images) ? images.slice(0, MAX_PHOTOS) : [];

  return mutateProduct(id, async (product) => {
    if (!text && photos.length === 0) throw new UserError("Message is empty");

    // Save attached photos first so Claude (and later turns) can read them from disk.
    const saved: string[] = [];
    try {
      for (const dataUrl of photos) {
        const { mime, buffer } = parseDataUrl(dataUrl);
        saved.push(await saveImage(id, "ref", mime, buffer));
      }
    } catch (error) {
      await Promise.all(saved.map((n) => deleteImage(id, n)));
      throw new UserError((error as Error).message);
    }

    try {
      const turn = await runTechPackTurn({
        productId: id,
        brand: product.useBrand === false ? null : await getBrand(),
        history: product.messages,
        current: product.techPack,
        productName: product.name,
        message: text,
        images: saved,
      });
      const now = new Date().toISOString();
      product.messages = [
        ...product.messages,
        { role: "user", content: text || "(reference photos)", at: now, ...(saved.length ? { images: saved } : {}) },
        { role: "assistant", content: turn.reply, at: now },
      ];
      applyTechPack(product, turn.techPack);
      if (product.name === "Untitled piece" && turn.techPack.styleName) product.name = turn.techPack.styleName;
    } catch (error) {
      await Promise.all(saved.map((n) => deleteImage(id, n)));
      throw error;
    }
  });
}
