import { NextResponse } from "next/server";
import { getCollection, saveCollection } from "@/lib/collections";
import { deleteImage, parseDataUrl, saveImage } from "@/lib/files";

type Ctx = { params: Promise<{ id: string }> };

/** Add moodboard images. Body: { images: dataUrl[] } */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await getCollection(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { images } = (await req.json().catch(() => ({}))) as { images?: string[] };
  const list = Array.isArray(images) ? images.slice(0, 12) : [];
  if (c.moodboard.length + list.length > 24) return NextResponse.json({ error: "A moodboard holds up to 24 images." }, { status: 400 });
  try {
    for (const d of list) {
      const { mime, buffer } = parseDataUrl(d);
      c.moodboard.push(await saveImage(c.id, "mood", mime, buffer));
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  await saveCollection(c);
  return NextResponse.json(c);
}

/** Remove one image. ?file= */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await getCollection(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const file = new URL(req.url).searchParams.get("file") ?? "";
  if (c.moodboard.includes(file)) {
    c.moodboard = c.moodboard.filter((f) => f !== file);
    await deleteImage(c.id, file).catch(() => {});
    await saveCollection(c);
  }
  return NextResponse.json(c);
}
