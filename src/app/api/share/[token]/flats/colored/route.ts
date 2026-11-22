import { productForToken } from "@/lib/share";
import { serveColoredFlat } from "@/lib/serve";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { token } = await params;
  return serveColoredFlat(await productForToken(token), req.url);
}
