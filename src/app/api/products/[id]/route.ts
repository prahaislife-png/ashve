import { NextResponse } from "next/server";
import { applyTechPack, deleteProduct, getProduct } from "@/lib/store";
import { ProductStatus, TechPackSchema } from "@/lib/schema";
import { mutateProduct, need, UserError } from "@/lib/route";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(product);
}

/** Manual edits: rename, change status, save an edited tech pack, or restore a revision. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    status?: ProductStatus;
    techPack?: unknown;
    restoreRevision?: number;
  };

  return mutateProduct(id, (product) => {
    if (typeof body.name === "string" && body.name.trim()) product.name = body.name.trim().slice(0, 120);
    if (body.status && ["draft", "sampling", "approved"].includes(body.status)) {
      product.status = body.status;
    }
    if (body.techPack !== undefined) {
      const parsed = TechPackSchema.safeParse(body.techPack);
      if (!parsed.success) throw new UserError("Tech pack is not in the right format");
      applyTechPack(product, parsed.data);
    }
    if (typeof body.restoreRevision === "number") {
      const rev = need(product.revisions[body.restoreRevision], "Revision not found", 404);
      applyTechPack(product, rev.techPack);
    }
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await deleteProduct(id);
  return NextResponse.json({ ok: true });
}
