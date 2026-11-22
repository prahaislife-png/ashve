import Link from "next/link";
import { FolderOpen, Plus, Ruler } from "lucide-react";
import { getBrand, listProducts } from "@/lib/store";
import { productViews } from "@/lib/schema";
import { fileUrl } from "@/lib/urls";
import NavLink from "@/components/NavLink";
import LogoMark from "@/components/LogoMark";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const [products, brand] = await Promise.all([listProducts(), getBrand()]);
  const recent = products.slice(0, 8);
  // Only show "Log out" when a password is in use (on your own computer there may be none).
  const passwordOn = !!process.env.APP_PASSWORD;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-panel px-3 py-4 md:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2 text-ink">
          <LogoMark />
          <span className="h-title text-[16px]">Tech Pack Studio</span>
        </Link>

        <Link href="/" className="btn btn-primary mb-4 w-full">
          <Plus size={15} /> New product
        </Link>

        <nav className="space-y-0.5 text-[13.5px]" aria-label="Main">
          <NavLink href="/workspace" icon={<FolderOpen size={15} />} label="All products" />
          <NavLink href="/brand" icon={<Ruler size={15} />} label="Brand DNA" />
        </nav>

        <div className="mt-7 px-2 text-[12.5px] text-muted">Recent</div>
        <ul className="mt-1.5 flex-1 space-y-px overflow-y-auto">
          {recent.map((p) => {
            const thumb = productViews(p)["product-front"]?.file;
            return (
              <li key={p.id}>
                <Link
                  href={`/products/${p.id}`}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-ink-2 transition-colors hover:bg-card hover:text-ink"
                >
                  <span className="h-9 w-7 shrink-0 overflow-hidden rounded-md bg-artifact shadow-elev-sm">
                    {thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileUrl(p.id, thumb)} alt="" className="h-full w-full object-contain" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px]">{p.name}</span>
                    <span className="status-chip mt-0.5 text-[11.5px] capitalize" data-status={p.status}>
                      {p.status}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
          {recent.length === 0 && <li className="px-2 text-[12.5px] text-muted">Your products appear here.</li>}
        </ul>

        <Link href="/brand" className="mt-3 rounded-lg px-2 py-2 text-[12.5px] text-ink-2 hover:bg-card">
          <div className="font-medium text-ink">{brand.name || "Set up your brand"}</div>
          <div className="text-muted">{brand.name ? "Brand DNA is on" : "Fabrics, colours, sizes, fit"}</div>
        </Link>
        {passwordOn && (
          <LogoutButton className="mt-1 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-ink-2 hover:bg-card hover:text-ink" />
        )}
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 border-b border-line bg-panel px-3 py-2 md:hidden">
          <Link href="/" className="mr-auto flex items-center gap-2">
            <LogoMark size={20} />
            <span className="h-title">Tech Pack Studio</span>
          </Link>
          <Link href="/workspace" className="btn btn-ghost">Products</Link>
          <Link href="/brand" className="btn btn-ghost">Brand</Link>
          {passwordOn && <LogoutButton compact className="btn btn-ghost" />}
        </div>
        {children}
      </div>
    </div>
  );
}
