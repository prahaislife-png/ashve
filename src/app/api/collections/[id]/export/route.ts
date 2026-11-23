import JSZip from "jszip";
import { collectionProducts, getCollection } from "@/lib/collections";
import { buildCollectionWorkbook, collectionSlug } from "@/lib/collectionExcel";
import { addFactoryPack } from "@/lib/exportZip";
import { packSlug } from "@/lib/excel";
import { getBrand } from "@/lib/store";
import { unitsOf } from "@/lib/locale";

export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

/** Every piece's factory pack plus the collection workbook, in one ZIP. */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await getCollection(id);
  if (!c) return new Response("Not found", { status: 404 });
  const brand = await getBrand();
  const units = unitsOf(new URL(req.url).searchParams.get("units") ?? brand.units);
  const products = await collectionProducts(c);
  const slug = collectionSlug(c);
  const zip = new JSZip();
  const root = zip.folder(slug)!;
  root.file(`${slug}-line-list.xlsx`, await buildCollectionWorkbook(c, products, brand, units));
  let i = 0;
  for (const p of products) {
    if (!p.techPack) continue;
    await addFactoryPack(root.folder(`${String(++i).padStart(2, "0")}-${packSlug(p)}`)!, p, brand, units);
  }
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${slug}-collection-pack.zip"` },
  });
}
