import type { Metadata } from "next";
import { collectionIdForToken } from "@/lib/share";
import { collectionProducts, getCollection } from "@/lib/collections";
import { lineRows, summarize } from "@/lib/collectionMath";
import { getBrand } from "@/lib/store";
import LineSheet from "@/components/LineSheet";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Collection", robots: { index: false, follow: false } };

/** Read-only collection for a vendor: the line sheet, each piece linking to its tech pack. */
export default async function CollectionVendorPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const id = await collectionIdForToken(token);
  const c = id ? await getCollection(id) : null;
  if (!c || c.share?.token !== token) {
    return (
      <div className="theme-light flex min-h-screen items-center justify-center bg-white p-6 text-center">
        <div>
          <p className="h-title text-xl text-ink">This link is no longer active</p>
          <p className="mt-1 text-[14px] text-muted">Ask the brand to send you a new link.</p>
        </div>
      </div>
    );
  }
  const [products, brand] = await Promise.all([collectionProducts(c), getBrand()]);
  const pieces = products.map(summarize);
  const rows = lineRows(c, pieces).filter((r) => r.piece?.hasTechPack);
  return (
    <LineSheet
      collection={c}
      rows={rows}
      brand={brand}
      prices="none"
      image={(r) => (r.piece?.thumb && r.piece.shareToken ? `/api/share/${r.piece.shareToken}/files/${r.piece.thumb}` : null)}
      mood={(f) => `/api/share/c/${token}/files/${f}`}
      link={(r) => (r.piece?.shareToken ? `/f/${r.piece.shareToken}` : null)}
      toolbar={
        <div className="no-print mb-6 flex flex-wrap items-center gap-2 rounded-lg bg-accent-soft p-3 text-[13.5px]">
          <span className="mr-auto">
            Shared by {brand.name || "the brand"}. Read only. Click a style to open its full tech pack, Excel and files.
          </span>
          <PrintButton />
        </div>
      }
    />
  );
}
