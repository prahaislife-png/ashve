import { getBrand, getProduct } from "@/lib/store";
import { buildFactoryZip } from "@/lib/exportZip";

type Ctx = { params: Promise<{ id: string }> };

/** Download every file for the factory in one ZIP. */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const product = await getProduct(id).catch(() => null);
  if (!product?.techPack) return new Response("Not found", { status: 404 });
  const { bytes, filename } = await buildFactoryZip(product, await getBrand());
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
