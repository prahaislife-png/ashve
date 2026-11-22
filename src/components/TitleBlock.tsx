import { Product } from "@/lib/schema";

/**
 * The product's title block, laid out like the box in the corner of a technical
 * drawing: the facts a factory reads first, each in its own ruled cell.
 */
export default function TitleBlock({ product }: { product: Product }) {
  const tp = product.techPack;
  if (!tp) return null;
  const cells: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: "Style no.", value: tp.styleNumber && tp.styleNumber !== "TBC" ? tp.styleNumber : "Not assigned", mono: true },
    { label: "Season", value: tp.season || "Not set" },
    {
      label: "Sizes",
      value:
        tp.sizes.length > 3
          ? `${tp.sizes[0]}–${tp.sizes[tp.sizes.length - 1]}, sample ${tp.baseSize}`
          : `${tp.sizes.join(" ")}, sample ${tp.baseSize}`,
      mono: true,
    },
    { label: "Revision", value: String(product.revisions.length + 1), mono: true },
    {
      label: "Status",
      value: (
        <span className="status-chip text-[13px] capitalize text-ink" data-status={product.status}>
          {product.status}
        </span>
      ),
    },
    { label: "Updated", value: new Date(product.updatedAt).toLocaleDateString(), mono: true },
  ];

  return (
    <div className="overflow-hidden rounded-[10px] border border-line-strong bg-card">
      <div className="border-b border-line-strong px-4 py-3">
        <div className="field-label">{tp.category || "Product"}</div>
        <div className="h-title mt-0.5 text-[22px] text-ink sm:text-[26px]">{tp.styleName || product.name}</div>
      </div>
      {/* gap-px over a line-coloured background draws the ruled cell borders at any column count */}
      <dl className="grid grid-cols-2 gap-px bg-line-strong sm:grid-cols-3 xl:grid-cols-6">
        {cells.map((c) => (
          <div key={c.label} className="bg-card px-4 py-2.5">
            <dt className="field-label">{c.label}</dt>
            <dd className={`mt-0.5 text-[13.5px] leading-snug text-ink ${c.mono ? "code" : ""}`}>{c.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
