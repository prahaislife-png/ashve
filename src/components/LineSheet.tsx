import { Brand, Collection } from "@/lib/schema";
import { LineRow, margin } from "@/lib/collectionMath";
import { money } from "@/lib/locale";

export type PriceMode = "retail" | "all" | "none";

/**
 * The collection line sheet: cover (story, palette, mood) and one card per
 * piece. Used for the printable line sheet, the collection PDF and the vendor link.
 */
export default function LineSheet({
  collection: c,
  rows,
  brand,
  image,
  mood,
  link,
  prices = "retail",
  toolbar,
}: {
  collection: Collection;
  rows: LineRow[];
  brand: Brand;
  /** URL of a row's product image, or null. */
  image: (r: LineRow) => string | null;
  mood: (file: string) => string;
  /** Optional link from a card (e.g. to the piece's tech pack on a vendor link). */
  link?: (r: LineRow) => string | null;
  prices?: PriceMode;
  toolbar?: React.ReactNode;
}) {
  const launch = c.launchDate ? new Date(`${c.launchDate}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
  return (
    <div className="theme-light mx-auto max-w-[297mm] bg-white px-6 py-6 text-[12px] text-ink print:max-w-none print:p-0">
      {toolbar}

      {/* cover */}
      <header className="grid gap-6 border-b-2 border-ink pb-5 sm:grid-cols-[1.1fr_1fr] print:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.2em] text-muted">{brand.name || "Line sheet"}</div>
          <h1 className="h-title mt-1 text-[34px] leading-none">{c.name}</h1>
          <p className="mt-2 text-[12.5px] text-ink-2">
            {[c.season, launch && `Launch ${launch}`, `${rows.length} ${rows.length === 1 ? "style" : "styles"}`].filter(Boolean).join(" · ")}
          </p>
          {c.story && <p className="mt-3 max-w-prose text-[12.5px] leading-relaxed text-ink">{c.story}</p>}
          {c.palette.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {c.palette.map((p, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="h-7 w-7 rounded-full border border-line" style={{ background: p.hex }} />
                  <span className="leading-tight">
                    <span className="block text-[11.5px] font-medium">{p.name}</span>
                    {p.pantone && <span className="block text-[10px] text-muted">{p.pantone}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {c.moodboard.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5 self-start">
            {c.moodboard.slice(0, 6).map((f, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={f} src={mood(f)} alt="" className={`w-full rounded object-cover ${i === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"}`} />
            ))}
          </div>
        )}
      </header>

      {/* pieces */}
      <ul className="mt-5 grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 print:grid-cols-4">
        {rows.map((r, i) => {
          const src = image(r);
          const href = link?.(r);
          const m = margin(r.cost, r.retail);
          const card = (
            <>
              <div className="flex aspect-[4/5] items-center justify-center rounded border border-line bg-white">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={r.name} className="h-full w-full object-contain p-2" />
                ) : (
                  <span className="text-[11px] text-muted">Image to come</span>
                )}
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="code text-[10.5px] text-muted">{r.piece?.styleNumber || `#${i + 1}`}</span>
                {prices !== "none" && r.retail != null && <span className="text-[12px] font-semibold">{money(r.retail, brand.currency)}</span>}
              </div>
              <div className="text-[13px] font-medium leading-snug">{r.name}</div>
              {r.piece?.description && <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-2">{r.piece.description}</p>}
              <dl className="mt-1.5 space-y-0.5 text-[10.5px] text-ink-2">
                {r.piece?.fabric && (
                  <div>
                    {r.piece.fabric}
                    {r.piece.gsm ? `, ${r.piece.gsm} GSM` : ""}
                  </div>
                )}
                {(r.piece?.sizes.length || c.sizes) && <div>Sizes {r.piece?.sizes.length ? r.piece.sizes.join(" ") : c.sizes}</div>}
                {prices === "all" && (r.cost != null || m != null) && (
                  <div>
                    Factory cost {money(r.cost, brand.currency)}
                    {m != null ? ` · ${m}% margin` : ""}
                    {r.piece?.moq ? ` · MOQ ${r.piece.moq}/colour` : ""}
                  </div>
                )}
              </dl>
              {r.colorways.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {r.colorways.map((cw) => (
                    <span key={cw.name} className="flex items-center gap-1 text-[10.5px]">
                      <span className="h-3 w-3 rounded-full border border-line" style={{ background: cw.hex }} />
                      {cw.name}
                    </span>
                  ))}
                </div>
              )}
            </>
          );
          return (
            <li key={r.plan?.id ?? r.piece?.id ?? i} className="print-section">
              {href ? (
                <a href={href} className="block rounded transition-opacity hover:opacity-80">
                  {card}
                </a>
              ) : (
                card
              )}
            </li>
          );
        })}
      </ul>

      <footer className="mt-8 border-t border-line pt-3 text-[9.5px] uppercase tracking-wider text-muted">
        {brand.name || "Tech Pack Studio"} · {c.name} · Confidential
      </footer>
    </div>
  );
}
