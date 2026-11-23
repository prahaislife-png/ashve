import { notFound } from "next/navigation";
import { collectionProducts, getCollection } from "@/lib/collections";
import { lineRows, summarize } from "@/lib/collectionMath";
import { getBrand } from "@/lib/store";
import { unitsOf } from "@/lib/locale";
import { fileUrl } from "@/lib/urls";
import LineSheet from "@/components/LineSheet";
import TechPackDocument from "@/components/TechPackDocument";
import PrintButton from "@/components/PrintButton";
import DocOptions from "@/components/DocOptions";

export const dynamic = "force-dynamic";

/** The whole collection as one document: line sheet, then every piece's tech pack. */
export default async function CollectionPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ units?: string; lang?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const c = await getCollection(id);
  if (!c) notFound();
  const [products, brand] = await Promise.all([collectionProducts(c), getBrand()]);
  const withPack = products.filter((p) => p.techPack);
  const units = unitsOf(sp.units ?? brand.units);
  // Languages every piece has been translated into.
  const common = withPack.length
    ? Object.keys(withPack[0].translations ?? {}).filter((l) => withPack.every((p) => p.translations?.[l]))
    : [];
  const lang = common.includes(sp.lang ?? "") ? sp.lang! : "en";

  return (
    <div className="bg-white">
      <LineSheet
        collection={c}
        rows={lineRows(c, products.map(summarize))}
        brand={brand}
        image={(r) => (r.piece?.thumb ? fileUrl(r.piece.id, r.piece.thumb) : null)}
        mood={(f) => `/api/collections/${c.id}/files/${f}`}
        toolbar={
          <div className="no-print mb-6 space-y-2 rounded-lg bg-accent-soft p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DocOptions path={`/collections/${c.id}/print`} units={units} lang={lang} languages={common} />
              <PrintButton />
            </div>
            <p className="text-[12.5px] text-ink-2">
              Line sheet first, then {withPack.length} tech {withPack.length === 1 ? "pack" : "packs"}. In the print window
              choose “Save as PDF” and turn on “Background graphics”.
            </p>
          </div>
        }
      />
      {withPack.map((p) => (
        <div key={p.id} className="page-break mt-10 print:mt-0">
          <TechPackDocument
            product={p}
            brand={brand}
            base={`/api/products/${p.id}`}
            units={units}
            lang={lang}
            translation={lang === "en" ? null : p.translations![lang]}
          />
        </div>
      ))}
    </div>
  );
}
