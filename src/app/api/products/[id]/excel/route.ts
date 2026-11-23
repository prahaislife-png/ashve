import { getBrand, getProduct } from "@/lib/store";
import { buildWorkbook, packSlug } from "@/lib/excel";
import { unitsOf } from "@/lib/locale";

type Ctx = { params: Promise<{ id: string }> };

/** Download the tech pack as an Excel workbook. */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const product = await getProduct(id).catch(() => null);
  if (!product?.techPack) return new Response("Not found", { status: 404 });
  const brand = await getBrand();
  const buf = await buildWorkbook(product, brand, unitsOf(new URL(req.url).searchParams.get("units") ?? brand.units));
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${packSlug(product)}-tech-pack.xlsx"`,
    },
  });
}
