import { randomUUID } from "crypto";
import { Ctx, mutateProduct, need } from "@/lib/route";
import { getBrand } from "@/lib/store";
import { readImage, saveImage } from "@/lib/files";
import { buildMockupPrompt, buildViewFromFrontPrompt, generateImage } from "@/lib/imagegen";
import { Mockup, MockupView, PRODUCT_VIEWS, productViews } from "@/lib/schema";

export const maxDuration = 300;

/**
 * Make the product views (front, side, back) shown in Design and Basic Product Specs.
 * Front is made from the tech pack (+ reference photos); side and back are made
 * from the front image so all three match. Body: { only?: "product-front" | ... , colorway?, note? }
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    only?: string;
    colorway?: string;
    note?: string;
  };

  return mutateProduct(id, async (product) => {
    const tp = need(product.techPack, "Create the tech pack first.");
    const names = tp.colorways.map((c) => c.name);
    const colorway = body.colorway && names.includes(body.colorway) ? body.colorway : (names[0] ?? "");
    const note = String(body.note ?? "").slice(0, 500);
    const only = (PRODUCT_VIEWS as readonly string[]).includes(body.only ?? "")
      ? (body.only as MockupView)
      : null;

    const add = (view: MockupView, file: string) => {
      const m: Mockup = {
        id: randomUUID(),
        file,
        view,
        colorway,
        note,
        editedFrom: null,
        inPdf: false,
        at: new Date().toISOString(),
      };
      product.mockups = [...(product.mockups ?? []), m];
      return m;
    };

    let front = productViews(product)["product-front"];
    if (!only || only === "product-front" || !front) {
      const refNames = product.messages.flatMap((m) => m.images ?? []).slice(-3);
      const refs = (await Promise.all(refNames.map((n) => readImage(id, n))))
        .filter((r) => r !== null)
        .map((r) => ({ mime: r.mime, data: r.buffer }));
      const prompt = buildMockupPrompt({
        techPack: tp,
        brand: await getBrand(),
        view: "product-front",
        colorway,
        note,
        hasReferences: refs.length > 0,
      });
      const img = await generateImage(prompt, refs, undefined, "Product views");
      front = add("product-front", await saveImage(id, "mockup", img.mime, img.data));
    }

    const frontImg = need(await readImage(id, front.file), "Front image is missing.");
    const others = (["product-side", "product-back"] as const).filter((v) => !only || only === v);
    // Side and back in parallel, both from the front image.
    const made = await Promise.all(
      others.map(async (v) => {
        const img = await generateImage(
          buildViewFromFrontPrompt(v, tp),
          [{ mime: frontImg.mime, data: frontImg.buffer }],
          undefined,
          "Product views",
        );
        return { v, file: await saveImage(id, "mockup", img.mime, img.data) };
      }),
    );
    for (const { v, file } of made) add(v, file);
  });
}
