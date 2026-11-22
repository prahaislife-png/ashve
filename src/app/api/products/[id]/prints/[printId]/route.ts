import { Ctx, mutateProduct, need } from "@/lib/route";
import { deleteImage } from "@/lib/files";

type P = Ctx<{ id: string; printId: string }>;

export async function PATCH(req: Request, { params }: P) {
  const { id, printId } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return mutateProduct(id, (product) => {
    const pr = need(product.prints?.find((p) => p.id === printId), "Print not found", 404);
    if (typeof body.name === "string") pr.name = body.name.slice(0, 80);
    if (typeof body.placement === "string") pr.placement = body.placement.slice(0, 120);
    if (typeof body.note === "string") pr.note = body.note.slice(0, 500);
    for (const k of ["widthCm", "heightCm"] as const) {
      if (k in body) pr[k] = body[k] === null || body[k] === "" ? null : Number(body[k]) || null;
    }
  });
}

export async function DELETE(_req: Request, { params }: P) {
  const { id, printId } = await params;
  return mutateProduct(id, async (product) => {
    const pr = need(product.prints?.find((p) => p.id === printId), "Print not found", 404);
    await deleteImage(id, pr.file);
    product.prints = product.prints!.filter((p) => p.id !== printId);
  });
}
