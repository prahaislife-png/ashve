import { Ctx, mutateProduct, need } from "@/lib/route";
import { getBrand } from "@/lib/store";
import { writeRfq } from "@/lib/ai";

export const maxDuration = 120;

/** Draft a request-for-quote email to a factory (the designer sends it herself). */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return mutateProduct(id, async (product) => {
    const tp = need(product.techPack, "Create the tech pack first.");
    const email = await writeRfq({ techPack: tp, brand: await getBrand() });
    product.rfq = { ...email, at: new Date().toISOString() };
  });
}
