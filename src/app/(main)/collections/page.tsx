import Link from "next/link";
import { collectionProducts, listCollections } from "@/lib/collections";
import { daysToLaunch } from "@/lib/collectionMath";
import { listProducts } from "@/lib/store";
import { productViews } from "@/lib/schema";
import { fileUrl } from "@/lib/urls";
import NewCollection from "@/components/collections/NewCollection";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  planning: "Planning",
  developing: "Developing",
  sampling: "Sampling",
  ready: "Ready for production",
  launched: "Launched",
};

export default async function CollectionsPage() {
  const [collections, products] = await Promise.all([listCollections(), listProducts()]);
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h-title text-[28px]">Collections</h1>
          <p className="mt-1 max-w-xl text-ink-2">
            Plan a drop as one line: the pieces, the palette and fabrics they share, and one line sheet and vendor pack
            for all of it.
          </p>
        </div>
        <NewCollection />
      </div>

      {collections.length === 0 ? (
        <div className="drafting-grid mt-10 rounded-xl px-6 py-14 text-center shadow-elev-sm">
          <p className="h-title text-xl text-ink">Plan your first drop</p>
          <p className="mx-auto mt-1 max-w-md text-ink-2">
            Start with a name and a story. Add pieces you already made, plan new ones, or let the assistant suggest
            what rounds out the line.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {await Promise.all(
            collections.map(async (c) => {
              const pieces = await collectionProducts(c, products);
              const thumbs = pieces.map((p) => ({ id: p.id, file: productViews(p)["product-front"]?.file })).filter((t) => t.file).slice(0, 3);
              const days = daysToLaunch(c);
              const count = Math.max(c.plan.length, pieces.length);
              return (
                <li key={c.id}>
                  <Link href={`/collections/${c.id}`} className="group block">
                    <div className="grid aspect-[16/11] grid-cols-3 gap-1 overflow-hidden rounded-xl bg-panel p-1 shadow-elev-sm transition-shadow group-hover:shadow-elev-md">
                      {c.moodboard[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/collections/${c.id}/files/${c.moodboard[0]}`} alt="" className="col-span-2 row-span-2 h-full w-full rounded-lg object-cover" />
                      ) : (
                        <div className="col-span-2 row-span-2 flex h-full items-end rounded-lg p-3" style={{ background: c.palette[0]?.hex ?? "var(--accent-soft)" }}>
                          <span className="flex gap-1">
                            {c.palette.slice(1, 6).map((p, i) => (
                              <span key={i} className="h-4 w-4 rounded-full border border-white/60" style={{ background: p.hex }} />
                            ))}
                          </span>
                        </div>
                      )}
                      {[0, 1].map((i) =>
                        thumbs[i] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={fileUrl(thumbs[i].id, thumbs[i].file!)} alt="" className="h-full w-full rounded-lg bg-artifact object-contain p-1" />
                        ) : (
                          <div key={i} className="rounded-lg bg-card" />
                        ),
                      )}
                    </div>
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-ink">{c.name}</div>
                        <div className="text-[13px] text-ink-2">
                          {[c.season, `${count} ${count === 1 ? "piece" : "pieces"}`].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="status-chip text-[12px]" data-status={c.status === "launched" || c.status === "ready" ? "approved" : c.status === "sampling" ? "sampling" : "draft"}>
                          {STATUS[c.status]}
                        </span>
                        {days != null && days >= 0 && <div className="num mt-0.5 text-[12px] text-muted">{days} days to launch</div>}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            }),
          )}
        </ul>
      )}
    </div>
  );
}
