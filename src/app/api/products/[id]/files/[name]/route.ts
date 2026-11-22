import { serveFile } from "@/lib/serve";

type Ctx = { params: Promise<{ id: string; name: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id, name } = await params;
  return serveFile(id, name);
}
