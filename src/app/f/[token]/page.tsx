import type { Metadata } from "next";
import { productForToken } from "@/lib/share";
import { getBrand } from "@/lib/store";
import TechPackDocument from "@/components/TechPackDocument";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

// Factory links are private: keep them out of search engines.
export const metadata: Metadata = { title: "Tech pack", robots: { index: false, follow: false } };

/** Read-only tech pack for a factory, opened from a private link. No login needed. */
export default async function FactoryLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
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
  return (
    <TechPackDocument
      product={product}
      brand={brand}
      base={base}
      toolbar={
        <div className="no-print mb-6 flex flex-wrap items-center gap-2 rounded-lg bg-accent-soft p-3 text-[13.5px]">
          <span className="mr-auto">
            Shared by {brand.name || "the brand"}. Read only. Last updated {new Date(product.updatedAt).toLocaleDateString()}.
          </span>
          <a className="btn" href={`${base}/excel`}>
            Excel
          </a>
          <a className="btn" href={`${base}/export`}>
            All files (ZIP)
          </a>
          <PrintButton />
        </div>
      }
    />
  );
}
