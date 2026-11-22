import { productForToken } from "@/lib/share";
import { getBrand } from "@/lib/store";
import { buildWorkbook, packSlug } from "@/lib/excel";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params;
  const product = await productForToken(token);
  if (!product) return new Response("This link is no longer active.", { status: 404 });
  const buf = await buildWorkbook(product, await getBrand());
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${packSlug(product)}-tech-pack.xlsx"`,
    },
  });
}
