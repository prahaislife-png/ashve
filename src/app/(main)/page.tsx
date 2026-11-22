import Link from "next/link";
import { getBrand, listProducts } from "@/lib/store";
import { productViews } from "@/lib/schema";
import { fileUrl } from "@/lib/urls";
import CreateBox from "@/components/CreateBox";

export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const [brand, products] = await Promise.all([getBrand(), listProducts()]);
  const hasBrand = !!(brand.name || brand.aesthetic || brand.fabrics);
  const recent = products.filter((p) => productViews(p)["product-front"]).slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-24 pt-[12vh]">
      <h1 className="h-title text-[34px] text-ink sm:text-[42px]">
        {brand.name ? `What is ${brand.name} making next?` : "What are you making next?"}
      </h1>
      <p className="mt-3 max-w-xl text-[15px] text-ink-2">
        Describe the garment the way you would to a pattern maker. You get renders, flats, a
        graded size chart and a pack a factory can quote from.
      </p>

      <CreateBox hasBrand={hasBrand} />

      {recent.length > 0 && (
        <section className="mt-16" aria-labelledby="recent-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="recent-heading" className="text-[13.5px] font-medium text-ink-2">
              Continue where you left off
            </h2>
            <Link href="/workspace" className="text-[13px] text-accent hover:underline">
              All products
            </Link>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {recent.map((p) => (
              <li key={p.id}>
                <Link href={`/products/${p.id}`} className="group block">
                  <div className="artifact aspect-[4/5] transition-shadow group-hover:shadow-elev-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fileUrl(p.id, productViews(p)["product-front"]!.file)}
                      alt=""
                      className="h-full w-full object-contain p-2"
                    />
                  </div>
                  <div className="mt-2 truncate text-[13px] text-ink">{p.name}</div>
                  <div className="status-chip capitalize" data-status={p.status}>
                    {p.status}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
