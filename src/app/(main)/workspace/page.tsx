import Link from "next/link";
import { Plus } from "lucide-react";
import { listProducts } from "@/lib/store";
import { OUTPUTS, outputStatus, productViews } from "@/lib/schema";
import { fileUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const products = await listProducts();
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h-title text-[28px]">All products</h1>
          <p className="mt-1 text-ink-2">Each product, and how far its tech pack has come.</p>
        </div>
        <Link href="/" className="btn btn-primary">
          <Plus size={15} /> New product
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="drafting-grid mt-10 flex flex-col items-center rounded-xl px-6 py-16 text-center shadow-elev-sm">
          <p className="h-title text-xl text-ink">No products yet</p>
          <p className="mt-1 max-w-sm text-ink-2">
            Describe your first garment and the tech pack builds itself from there.
          </p>
          <Link href="/" className="btn btn-primary mt-5">
            Create the first product
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => {
            const thumb = productViews(p)["product-front"]?.file;
            const status = outputStatus(p);
            const done = OUTPUTS.filter((o) => status[o.key]).length;
            return (
              <li key={p.id}>
                <Link href={`/products/${p.id}`} className="group block">
                  <div
                    className={`artifact flex aspect-[4/5] items-center justify-center transition-shadow group-hover:shadow-elev-md ${
                      thumb ? "" : "drafting-grid"
                    }`}
                  >
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileUrl(p.id, thumb)} alt="" className="h-full w-full object-contain p-3" />
                    ) : (
                      <span className="text-[12.5px] text-muted">No renders yet</span>
                    )}
                  </div>
                  <div className="mt-2.5 truncate font-medium text-ink">{p.name}</div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="status-chip capitalize" data-status={p.status}>
                      {p.status}
                    </span>
                    <span className="num text-[12.5px] text-muted">
                      {done} of {OUTPUTS.length} ready
                    </span>
                  </div>
                  <div
                    className="mt-2 flex gap-1"
                    role="img"
                    aria-label={`${done} of ${OUTPUTS.length} outputs ready`}
                  >
                    {OUTPUTS.map((o) => (
                      <span
                        key={o.key}
                        className={`h-1 flex-1 rounded-full ${status[o.key] ? "bg-accent" : "bg-line"}`}
                        title={o.label}
                      />
                    ))}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
