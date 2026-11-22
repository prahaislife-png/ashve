import { getProduct } from "@/lib/store";
import { serveColoredFlat } from "@/lib/serve";

type Ctx = { params: Promise<{ id: string }> };

/** Coloured sketch. GET ?side=front|back&hex=RRGGBB */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  return serveColoredFlat(await getProduct(id).catch(() => null), req.url);
}
