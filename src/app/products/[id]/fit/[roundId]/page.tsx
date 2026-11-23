import { notFound } from "next/navigation";
import { getBrand, getProduct } from "@/lib/store";
import { unitsOf } from "@/lib/locale";
import FitReport from "@/components/FitReport";
import PrintButton from "@/components/PrintButton";
import DocOptions from "@/components/DocOptions";

export const dynamic = "force-dynamic";

/** Printable fit comments for one sample round, to send to the vendor. */
export default async function FitPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; roundId: string }>;
  searchParams: Promise<{ units?: string; lang?: string }>;
}) {
  const { id, roundId } = await params;
  const sp = await searchParams;
  const [product, brand] = await Promise.all([getProduct(id).catch(() => null), getBrand()]);
  const round = product?.samples?.find((r) => r.id === roundId);
  if (!product || !round) notFound();
  const units = unitsOf(sp.units ?? brand.units);
  const available = Object.keys(product.translations ?? {});
  const lang = available.includes(sp.lang ?? "") ? sp.lang! : "en";
  return (
    <FitReport
      product={product}
      round={round}
      brand={brand}
      base={`/api/products/${product.id}`}
      units={units}
      lang={lang}
      translation={lang === "en" ? null : product.translations![lang]}
      toolbar={
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-accent-soft p-3 text-sm">
          <DocOptions path={`/products/${product.id}/fit/${round.id}`} units={units} lang={lang} languages={available} />
          <PrintButton />
        </div>
      }
    />
  );
}
