import { getBrand, getProduct } from "@/lib/store";
import { buildWorkbook, packSlug } from "@/lib/excel";

type Ctx = { params: Promise<{ id: string }> };

/** Download the tech pack as an Excel workbook. */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const product = await getProduct(id).catch(() => null);
  if (!product?.techPack) return new Response("Not found", { status: 404 });
  const buf = await buildWorkbook(product, await getBrand());
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${packSlug(product)}-tech-pack.xlsx"`,
    },
  });
}
