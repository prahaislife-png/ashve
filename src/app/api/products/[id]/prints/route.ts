import { randomUUID } from "crypto";
import { Ctx, mutateProduct, need } from "@/lib/route";
import { getBrand } from "@/lib/store";
import { parseDataUrl, saveImage } from "@/lib/files";
import { buildPrintPrompt, generateImage } from "@/lib/imagegen";

export const maxDuration = 120;

/**
 * Add a print file.
 * { mode: "ai", kind, description, name?, placement?, widthCm?, heightCm? }
 * { mode: "upload", dataUrl, kind, name?, placement?, widthCm?, heightCm? }
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    mode?: string;
    kind?: string;
    description?: string;
    dataUrl?: string;
    name?: string;
    placement?: string;
    widthCm?: number | string | null;
    heightCm?: number | string | null;
  };

  return mutateProduct(id, async (product) => {
    const tp = need(product.techPack, "Create the tech pack first.");
    const kind = body.kind === "placement" ? "placement" : "repeat";
    const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v) || null);

    let file: string;
    let source: "ai" | "upload";
    if (body.mode === "upload") {
      const { mime, buffer } = parseDataUrl(need(body.dataUrl, "Choose an image file."));
      file = await saveImage(id, "mockup", mime, buffer);
      source = "upload";
    } else {
      const description = need(body.description?.trim() || null, "Describe the print you want.");
      const brand = await getBrand();
      const colors = [...tp.colorways, ...tp.accentColors].map((c) => `${c.name} ${c.hex}`).slice(0, 6);
      const img = await generateImage(
        buildPrintPrompt({ kind, description, colors, aesthetic: brand.aesthetic }),
        [],
        "1024x1024",
        "Print file",
      );
      file = await saveImage(id, "mockup", img.mime, img.data);
      source = "ai";
    }

    product.prints = [
      ...(product.prints ?? []),
      {
        id: randomUUID(),
        file,
        kind,
        name: String(body.name || (kind === "repeat" ? "All-over print" : "Placement print")).slice(0, 80),
        placement: String(body.placement ?? (kind === "repeat" ? "All-over" : "Centre front")).slice(0, 120),
        widthCm: num(body.widthCm),
        heightCm: num(body.heightCm),
        note: String(body.description ?? "").slice(0, 500),
        source,
        at: new Date().toISOString(),
      },
    ];
  });
}
