import { readImage } from "@/lib/files";

type Ctx = { params: Promise<{ id: string; name: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id, name } = await params;
  let image;
  try {
    image = await readImage(id, name);
  } catch {
    image = null;
  }
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.buffer), {
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      // Belt and braces for SVGs: never run scripts or load anything if opened directly.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
