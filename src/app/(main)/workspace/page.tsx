import Link from "next/link";
import { Plus } from "lucide-react";
import { listProducts } from "@/lib/store";
import { OUTPUTS, outputStatus, productViews } from "@/lib/schema";
import { fileUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const products = await listProducts();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="h-title text-2xl">Workspace</h1>
          <p className="mt-1 text-sm text-muted">Every product, and how far its tech pack has got.</p>
        </div>
        <Link href="/" className="btn btn-primary">
          <Plus size={15} /> New product
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="mt-16 text-center text-sm text-muted">
          No products yet. <Link className="underline" href="/">Create the first one</Link>.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => {
            const thumb = productViews(p)["product-front"]?.file;
            const status = outputStatus(p);
            const done = OUTPUTS.filter((o) => status[o.key]).length;
            return (
              <li key={p.id}>
                <Link href={`/products/${p.id}`} className="card block overflow-hidden hover:border-accent">
                  <div className="flex aspect-[4/5] items-center justify-center bg-white">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileUrl(p.id, thumb)} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-xs text-muted">No views yet</span>
                    )}
                  </div>
                  <div className="border-t border-line p-3">
                    <div className="truncate text-sm font-medium">{p.name}</div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted">
                      <span className="capitalize">{p.status}</span>
                      <span>
                        {done}/{OUTPUTS.length} outputs
                      </span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded bg-accent-soft">
                      <div className="h-full bg-accent" style={{ width: `${(done / OUTPUTS.length) * 100}%` }} />
                    </div>
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
