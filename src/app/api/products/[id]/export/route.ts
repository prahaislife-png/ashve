import { getBrand, getProduct } from "@/lib/store";
import { buildFactoryZip } from "@/lib/exportZip";
import { unitsOf } from "@/lib/locale";

type Ctx = { params: Promise<{ id: string }> };

/** Download every file for the factory in one ZIP. */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const product = await getProduct(id).catch(() => null);
  if (!product?.techPack) return new Response("Not found", { status: 404 });
  const brand = await getBrand();
  const { bytes, filename } = await buildFactoryZip(product, brand, unitsOf(new URL(req.url).searchParams.get("units") ?? brand.units));
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
