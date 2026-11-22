import Link from "next/link";
import { FolderOpen, Sparkles, Dna } from "lucide-react";
import { getBrand, listProducts } from "@/lib/store";
import { productViews } from "@/lib/schema";
import { fileUrl } from "@/lib/urls";
import NavLink from "@/components/NavLink";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const [products, brand] = await Promise.all([listProducts(), getBrand()]);
  const recent = products.slice(0, 8);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-panel px-3 py-4 md:flex">
        <Link href="/" className="mb-5 flex items-center gap-2 px-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
            T
          </span>
          <span className="h-title text-[15px]">Tech Pack Studio</span>
        </Link>

        <nav className="space-y-0.5 text-sm">
          <NavLink href="/" icon={<Sparkles size={15} />} label="Create" exact />
          <NavLink href="/workspace" icon={<FolderOpen size={15} />} label="Workspace" />
          <NavLink href="/brand" icon={<Dna size={15} />} label="Brand DNA" />
        </nav>

        <div className="mt-6 px-2 text-xs font-medium text-muted">Recent products</div>
        <ul className="mt-2 flex-1 space-y-0.5 overflow-y-auto">
          {recent.map((p) => {
            const thumb = productViews(p)["product-front"]?.file;
            return (
              <li key={p.id}>
                <Link
                  href={`/products/${p.id}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent-soft"
                >
                  <span className="h-8 w-6 shrink-0 overflow-hidden rounded bg-accent-soft">
                    {thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileUrl(p.id, thumb)} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px]">{p.name}</span>
                    <span className="block text-[11px] text-muted">
                      {p.status} · {new Date(p.updatedAt).toLocaleDateString()}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
          {recent.length === 0 && <li className="px-2 text-xs text-muted">Nothing yet</li>}
        </ul>

        <div className="mt-3 rounded-lg border border-line bg-card px-3 py-2 text-xs">
          <div className="font-medium">{brand.name || "Your brand"}</div>
          <div className="text-muted">Unlimited. Pay only for API usage</div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* mobile top nav */}
        <div className="flex items-center gap-1 border-b border-line bg-panel px-3 py-2 text-sm md:hidden">
          <Link href="/" className="h-title mr-auto">Tech Pack Studio</Link>
          <Link href="/workspace" className="btn btn-ghost">Workspace</Link>
          <Link href="/brand" className="btn btn-ghost">Brand</Link>
        </div>
        {children}
      </div>
    </div>
  );
}
