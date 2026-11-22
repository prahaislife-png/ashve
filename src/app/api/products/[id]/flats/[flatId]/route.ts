import { Ctx, mutateProduct, need } from "@/lib/route";
import { deleteImage } from "@/lib/files";

type P = Ctx<{ id: string; flatId: string }>;

/** Make an older drawing set the current one (moves it to the end). */
export async function PATCH(_req: Request, { params }: P) {
  const { id, flatId } = await params;
  return mutateProduct(id, (product) => {
    const set = need(product.flats?.find((f) => f.id === flatId), "Drawing set not found", 404);
    product.flats = [...product.flats!.filter((f) => f.id !== flatId), set];
  });
}

export async function DELETE(_req: Request, { params }: P) {
  const { id, flatId } = await params;
  return mutateProduct(id, async (product) => {
    const set = need(product.flats?.find((f) => f.id === flatId), "Drawing set not found", 404);
    product.flats = product.flats!.filter((f) => f.id !== flatId);
    await Promise.all(
      [set.front, set.back, set.measurementGuide, set.technical].filter(Boolean).map((n) => deleteImage(id, n!)),
    );
  });
}
