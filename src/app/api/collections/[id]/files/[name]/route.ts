import { serveFile } from "@/lib/serve";

type Ctx = { params: Promise<{ id: string; name: string }> };

/** Moodboard images (stored like product files, under the collection's id). */
export async function GET(_req: Request, { params }: Ctx) {
  const { id, name } = await params;
  return serveFile(id, name);
}
