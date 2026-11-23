import type { Metadata } from "next";
import { productForToken } from "@/lib/share";
import { getBrand } from "@/lib/store";
import { unitsOf } from "@/lib/locale";
import TechPackDocument from "@/components/TechPackDocument";
import PrintButton from "@/components/PrintButton";
import DocOptions from "@/components/DocOptions";
import FitReport from "@/components/FitReport";

export const dynamic = "force-dynamic";

// Factory links are private: keep them out of search engines.
export const metadata: Metadata = { title: "Tech pack", robots: { index: false, follow: false } };

/** Read-only tech pack for a factory, opened from a private link. No login needed. */
export default async function FactoryLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ units?: string; lang?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const product = await productForToken(token);

  if (!product) {
    return (
      <div className="theme-light flex min-h-screen items-center justify-center bg-white p-6 text-center">
        <div>
          <p className="h-title text-xl text-ink">This link is no longer active</p>
          <p className="mt-1 text-[14px] text-muted">Ask the brand to send you a new link.</p>
        </div>
      </div>
    );
  }

  const brand = await getBrand();
  const base = `/api/share/${token}`;
  const units = unitsOf(sp.units ?? brand.units);
  const available = Object.keys(product.translations ?? {});
  const wanted = sp.lang ?? brand.factoryLanguage ?? "en";
  const lang = available.includes(wanted) ? wanted : "en";
  const translation = lang === "en" ? null : product.translations![lang];
  // The latest sample round the brand has reviewed: the vendor needs these comments.
  const lastRound = [...(product.samples ?? [])].reverse().find((r) => r.status === "reviewed");

  return (
    <>
      <TechPackDocument
        product={product}
        brand={brand}
        base={base}
        units={units}
        lang={lang}
        translation={translation}
        toolbar={
          <div className="no-print mb-6 space-y-2 rounded-lg bg-accent-soft p-3 text-[13.5px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto">
                Shared by {brand.name || "the brand"}. Read only. Last updated{" "}
                {new Date(product.updatedAt).toLocaleDateString("en-GB")}.
              </span>
              <a className="btn" href={`${base}/excel?units=${units}`}>
                Excel
              </a>
              <a className="btn" href={`${base}/export?units=${units}`}>
                All files (ZIP)
              </a>
              <PrintButton />
            </div>
            <DocOptions path={`/f/${token}`} units={units} lang={lang} languages={available} />
          </div>
        }
      />
      {lastRound && (
        <div className="page-break">
          <FitReport
            product={product}
            round={lastRound}
            brand={brand}
            base={base}
            units={units}
            lang={lang}
            translation={translation}
          />
        </div>
      )}
    </>
  );
}
