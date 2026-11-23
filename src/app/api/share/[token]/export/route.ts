import { productForToken } from "@/lib/share";
import { getBrand } from "@/lib/store";
import { buildFactoryZip } from "@/lib/exportZip";
import { unitsOf } from "@/lib/locale";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { token } = await params;
  const product = await productForToken(token);
  if (!product) return new Response("This link is no longer active.", { status: 404 });
  const brand = await getBrand();
  const { bytes, filename } = await buildFactoryZip(product, brand, unitsOf(new URL(req.url).searchParams.get("units") ?? brand.units));
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
