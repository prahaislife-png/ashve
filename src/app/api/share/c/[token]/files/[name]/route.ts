import { collectionIdForToken } from "@/lib/share";
import { getCollection } from "@/lib/collections";
import { serveFile } from "@/lib/serve";

type Ctx = { params: Promise<{ token: string; name: string }> };

/** Moodboard images for a collection vendor link. Only that collection's images. */
export async function GET(_req: Request, { params }: Ctx) {
  const { token, name } = await params;
  const id = await collectionIdForToken(token);
  const c = id ? await getCollection(id) : null;
  if (!c || c.share?.token !== token || !c.moodboard.includes(name)) return new Response("Not found", { status: 404 });
  return serveFile(c.id, name);
}
