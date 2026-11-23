import Link from "next/link";
import { notFound } from "next/navigation";
import { collectionProducts, getCollection } from "@/lib/collections";
import { lineRows, summarize } from "@/lib/collectionMath";
import { getBrand } from "@/lib/store";
import { fileUrl } from "@/lib/urls";
import LineSheet, { PriceMode } from "@/components/LineSheet";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function LineSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ prices?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const c = await getCollection(id);
  if (!c) notFound();
  const [products, brand] = await Promise.all([collectionProducts(c), getBrand()]);
  const rows = lineRows(c, products.map(summarize));
  const prices: PriceMode = sp.prices === "all" || sp.prices === "none" ? sp.prices : "retail";
  const pill = (on: boolean) => `rounded px-2.5 py-1 text-[12.5px] ${on ? "bg-accent text-accent-ink" : "text-ink-2 hover:text-ink"}`;
  return (
    <>
      <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>
      <LineSheet
        collection={c}
        rows={rows}
        brand={brand}
        prices={prices}
        image={(r) => (r.piece?.thumb ? fileUrl(r.piece.id, r.piece.thumb) : null)}
        mood={(f) => `/api/collections/${c.id}/files/${f}`}
        toolbar={
          <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-accent-soft p-3 text-sm">
            <div className="flex items-center gap-2">
              Prices
              <div className="flex rounded-md bg-card/70 p-0.5">
                {(["retail", "all", "none"] as const).map((m) => (
                  <Link key={m} href={`?prices=${m}`} className={pill(prices === m)}>
                    {m === "retail" ? "Retail" : m === "all" ? "Retail and cost" : "No prices"}
                  </Link>
                ))}
              </div>
            </div>
            <PrintButton />
          </div>
        }
      />
    </>
  );
}
