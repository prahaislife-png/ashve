import { Ctx, mutateProduct, need } from "@/lib/route";
import { newToken, removeShare, saveShare } from "@/lib/share";

/** Turn on the read-only factory link (or make a fresh one, which turns the old one off). */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return mutateProduct(id, async (product) => {
    need(product.techPack, "Create the tech pack first.");
    if (product.share?.token) await removeShare(product.share.token);
    const token = newToken();
    await saveShare(token, product.id);
    product.share = { token, createdAt: new Date().toISOString() };
  });
}

/** Turn the factory link off. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return mutateProduct(id, async (product) => {
    if (product.share?.token) await removeShare(product.share.token);
    product.share = null;
  });
}
