import { collectionProducts, getCollection } from "@/lib/collections";
import { buildCollectionWorkbook, collectionSlug } from "@/lib/collectionExcel";
import { getBrand } from "@/lib/store";
import { unitsOf } from "@/lib/locale";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await getCollection(id);
  if (!c) return new Response("Not found", { status: 404 });
  const brand = await getBrand();
  const units = unitsOf(new URL(req.url).searchParams.get("units") ?? brand.units);
  const buf = await buildCollectionWorkbook(c, await collectionProducts(c), brand, units);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${collectionSlug(c)}-line-list.xlsx"`,
    },
  });
}
