import { notFound } from "next/navigation";
import { getBrand, getProduct } from "@/lib/store";
import { unitsOf } from "@/lib/locale";
import { fingerprint } from "@/lib/translate";
import PrintButton from "@/components/PrintButton";
import TechPackDocument from "@/components/TechPackDocument";
import DocOptions from "@/components/DocOptions";

export const dynamic = "force-dynamic";

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ units?: string; lang?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [product, brand] = await Promise.all([getProduct(id).catch(() => null), getBrand()]);
  if (!product?.techPack) notFound();
  const units = unitsOf(sp.units ?? brand.units);
  const available = Object.keys(product.translations ?? {});
  const wanted = sp.lang ?? brand.factoryLanguage ?? "en";
  const lang = available.includes(wanted) ? wanted : "en";
  const translation = lang === "en" ? null : product.translations![lang];
  const stale = translation && translation.source !== fingerprint(product.techPack);

  return (
    <TechPackDocument
      product={product}
      brand={brand}
      base={`/api/products/${product.id}`}
      units={units}
      lang={lang}
      translation={translation}
      toolbar={
        <div className="no-print mb-6 space-y-2 rounded-lg bg-accent-soft p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DocOptions path={`/products/${product.id}/print`} units={units} lang={lang} languages={available} />
            <PrintButton />
          </div>
          <p className="text-[12.5px] text-ink-2">
            In the print window choose “Save as PDF”. Turn on “Background graphics” for colour swatches.
          </p>
          {stale && (
            <p className="rounded bg-warn-soft px-2.5 py-1.5 text-[12.5px] text-warn-ink">
              The tech pack changed after this translation was made. Update it in Hand off so the vendor gets the
              latest text.
            </p>
          )}
        </div>
      }
    />
  );
}
