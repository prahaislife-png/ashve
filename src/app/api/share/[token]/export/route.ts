import { productForToken } from "@/lib/share";
import { getBrand } from "@/lib/store";
import { buildFactoryZip } from "@/lib/exportZip";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params;
  const product = await productForToken(token);
  if (!product) return new Response("This link is no longer active.", { status: 404 });
  const { bytes, filename } = await buildFactoryZip(product, await getBrand());
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
