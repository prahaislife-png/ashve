import { PinnedImage } from "@/components/specs/DetailedSpecs";
import { Brand, metaFor, MOCKUP_VIEWS, Product, PRODUCT_VIEWS, productViews, Translation } from "@/lib/schema";
import { isRtl, measure, money, Units } from "@/lib/locale";
import { T, translator } from "@/lib/translate";
import { scriptFontStack, scriptFontVars } from "@/lib/scriptFonts";

/**
 * Text in the factory's language with the English underneath (English only when
 * there is no translation). `inline` keeps both on one line, for short labels.
 */
export function Bi({ en, t, inline = false }: { en: string | null | undefined; t: T; inline?: boolean }) {
  if (!en) return null;
  const x = t(en);
  if (!x || x === en) return <>{en}</>;
  if (inline)
    return (
      <>
        {x} <span className="text-[0.85em] font-normal normal-case tracking-normal text-muted">/ {en}</span>
      </>
    );
  return (
    <span className="block">
      <span className="block">{x}</span>
      <span className="block text-[0.85em] font-normal normal-case tracking-normal text-muted">{en}</span>
    </span>
  );
}

function PageHead({ title, subtitle, page, brand, rev, t }: { title: string; subtitle?: React.ReactNode; page: string; brand: string; rev: number; t: T }) {
  return (
    <div className="mb-4 flex items-start justify-between border-b-2 border-ink pb-2">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted">{brand || "Tech pack"}</div>
        <div className="h-title text-lg"><Bi en={title} t={t} inline /></div>
        {subtitle && <div className="text-[11px] text-muted">{subtitle}</div>}
      </div>
      <div className="text-right text-[10px] text-muted">
        <div>{page}</div>
        <div><Bi en="Revision" t={t} inline /> {rev}</div>
      </div>
    </div>
  );
}

function H({ children, t }: { children: string; t: T }) {
  return (
    <h3 className="mb-1.5 mt-4 border-b border-line pb-1 text-[11px] font-semibold uppercase tracking-wider">
      <Bi en={children} t={t} inline />
    </h3>
  );
}

/**
 * The printable tech pack. Used by the PDF page (logged in) and the factory link
 * (read-only, by token). `base` is where its files come from, e.g. /api/products/<id>.
 */
export default function TechPackDocument({
  product,
  brand,
  base,
  toolbar,
  units = "cm",
  lang = "en",
  translation = null,
}: {
  product: Product;
  brand: Brand;
  base: string;
  toolbar?: React.ReactNode;
  units?: Units;
  lang?: string;
  translation?: Translation | null;
}) {
  const tp = product.techPack!;
  const t = translator(lang === "en" ? null : translation);
  const M = (v: number | null | undefined) => measure(v, units);
  const cur = brand.currency;
  const url = (f: string) => `${base}/files/${f}`;
  const views = productViews(product);
  const flats = product.flats?.at(-1);
  const pins = product.details ?? [];
  const pinImages = [...new Set(pins.map((p) => p.image))];
  const prints = product.prints ?? [];
  const labels = product.labels;
  const extraImages = (product.mockups ?? []).filter((m) => m.inPdf && !m.view.startsWith("product-")).slice(-4);
  const refs = product.messages.flatMap((m) => m.images ?? []).slice(-8);
  const rev = product.revisions.length;
  const brandName = brand.name;
  const sections = ["Overview", flats && "Flats", "Measurements", "Construction", (prints.length || labels?.product.file || labels?.hangTag.file) && "Prints & labels"].filter(Boolean);
  const total = sections.length;
  let n = 0;
  const pg = () => `PAGE ${++n} / ${total}`;

  return (
    <div
      className={`theme-light ${scriptFontVars} mx-auto max-w-[210mm] bg-white px-6 py-6 text-[12px] text-ink print:max-w-none print:p-0`}
      style={{ fontFamily: scriptFontStack }}
      lang={lang}
      dir={isRtl(lang) ? "rtl" : undefined}
    >
      {toolbar}

      {/* ---------- 1. Overview ---------- */}
      <section>
        <div className="mb-4 flex items-start justify-between gap-6 border-b-2 border-ink pb-3">
          <div className="max-w-[60%]">
            <div className="h-title text-xl">{tp.styleName}</div>
            <p className="mt-1 text-[11px] leading-snug text-muted"><Bi en={tp.description} t={t} /></p>
            <div className="mt-1 text-[10px] font-semibold"><Bi en="Revision" t={t} inline />: {rev}</div>
          </div>
          <div className="text-right text-[11px] leading-relaxed">
            <div className="text-[10px] text-muted">{pg()}</div>
            <div><span className="text-muted"><Bi en="Style no." t={t} inline /></span> {tp.styleNumber || "TBC"}</div>
            <div><span className="text-muted"><Bi en="Category" t={t} inline /></span> {tp.category}</div>
            <div><span className="text-muted"><Bi en="Sub-category" t={t} inline /></span> {tp.subcategory}</div>
            <div><span className="text-muted"><Bi en="Season" t={t} inline /></span> {tp.season || "—"}</div>
            <div><span className="text-muted"><Bi en="Designer" t={t} inline /></span> {brandName || "—"}</div>
            <div><span className="text-muted"><Bi en="Issued" t={t} inline /></span> {new Date(product.updatedAt).toLocaleDateString("en-GB")}</div>
          </div>
        </div>

        {Object.keys(views).length > 0 && (
          <div className="print-section grid grid-cols-3 gap-3">
            {PRODUCT_VIEWS.map((v) => (
              <figure key={v} className="rounded border border-line p-1.5">
                <figcaption className="mb-1 text-[9px] uppercase tracking-wider text-muted"><Bi en={v === "product-front" ? "Front" : v === "product-back" ? "Back" : "Side"} t={t} inline /></figcaption>
                {views[v] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url(views[v]!.file)} alt={MOCKUP_VIEWS[v]} className="aspect-[4/5] w-full object-contain" />
                ) : (
                  <div className="aspect-[4/5]" />
                )}
              </figure>
            ))}
          </div>
        )}

        <div className="mt-2 grid grid-cols-2 gap-6">
          <div>
            <H t={t}>Product summary</H>
            <dl className="space-y-1 text-[11px]">
              {(
                [
                  ["Category", <><Bi en={tp.category} t={t} inline /> / <Bi en={tp.subcategory} t={t} inline /></>],
                  ["Product type", <Bi key="pt" en={tp.productType} t={t} />],
                  ["Fit", <Bi key="fit" en={tp.fit} t={t} />],
                  ["Intended use", <Bi key="use" en={tp.intendedUse} t={t} />],
                  ["Target market", <Bi key="mkt" en={tp.targetMarket} t={t} />],
                  ["Sizes", `${tp.sizes.join(", ")} (${t("Sample size") ?? "sample"} ${tp.baseSize})`],
                  ["Est. weight", tp.estimatedWeightG ? `${tp.estimatedWeightG} g (M)` : "—"],
                  ["Pattern", tp.pattern ? <Bi key="pat" en={tp.pattern} t={t} /> : "—"],
                ] as [string, React.ReactNode][]
              ).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[90px_1fr] gap-2">
                  <dt className="text-muted"><Bi en={k} t={t} /></dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <H t={t}>Colourway</H>
            <div className="space-y-1">
              {tp.colorways.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded border border-line" style={{ background: c.hex }} />
                  <span className="font-medium">{c.name}</span>
                  <span className="text-[10px] text-muted">{[c.pantone, c.hex].filter(Boolean).join(" · ")}</span>
                </div>
              ))}
            </div>
            {tp.accentColors.length > 0 && (
              <>
                <H t={t}>Secondary colours</H>
                <div className="space-y-1">
                  {tp.accentColors.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded border border-line" style={{ background: c.hex }} />
                      <span>{c.name}</span>
                      <span className="text-[10px] text-muted">{c.hex}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div>
            <H t={t}>Bill of materials</H>
            <table className="tp-table text-[10.5px]">
              <thead>
                <tr>
                  <th><Bi en="Component" t={t} /></th>
                  <th><Bi en="Material" t={t} /></th>
                  <th><Bi en="Spec" t={t} /></th>
                </tr>
              </thead>
              <tbody>
                {tp.fabrics.map((f, i) => (
                  <tr key={`f${i}`}>
                    <td className="font-medium"><Bi en={f.placement} t={t} /></td>
                    <td><Bi en={f.composition} t={t} />, <Bi en={f.construction} t={t} /></td>
                    <td>{f.weightGsm ? `${f.weightGsm} GSM` : ""}{f.weightGsm && f.finish ? ", " : ""}<Bi en={f.finish} t={t} /></td>
                  </tr>
                ))}
                {tp.trims.map((tr, i) => (
                  <tr key={`t${i}`}>
                    <td className="font-medium"><Bi en={tr.item} t={t} /></td>
                    <td><Bi en={tr.description} t={t} /></td>
                    <td><Bi en={tr.placement} t={t} /> · <Bi en={tr.quantity} t={t} inline /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ---------- 2. Flats ---------- */}
      {flats && (
        <section className="page-break mt-10 print:mt-0">
          <PageHead title="Flat sketches" subtitle={<Bi en="Technical flats drawn to the sample size" t={t} inline />} page={pg()} brand={brandName} rev={rev} t={t} />
          <div className="grid grid-cols-2 gap-3">
            {[["Front", flats.front], ["Back", flats.back]].map(([label, f]) => (
              <figure key={label} className="rounded border border-line p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url(f)} alt={`${label} flat`} className="aspect-[4/3] w-full object-contain" />
              </figure>
            ))}
          </div>
          {tp.colorways[0] && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(["front", "back"] as const).map((side) => (
                <figure key={side} className="rounded border border-line p-1.5">
                  <figcaption className="text-[9px] uppercase tracking-wider text-muted"><Bi en="Coloured sketch" t={t} inline /> – <Bi en={side === "front" ? "Front" : "Back"} t={t} inline /> – {tp.colorways[0].name}</figcaption>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${base}/flats/colored?side=${side}&hex=${tp.colorways[0].hex.replace("#", "")}`} alt={`Coloured ${side}`} className="aspect-[4/3] w-full object-contain" />
                </figure>
              ))}
            </div>
          )}
          {flats.technical && (
            <div className="print-section mt-4 grid grid-cols-[1.5fr_1fr] gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url(flats.technical)} alt="Technical sketch" className="w-full rounded border border-line object-contain" />
              <ol className="space-y-1 text-[10.5px]">
                {(flats.technicalNotes ?? []).map((c) => (
                  <li key={c.n}>
                    <span className="mr-1 font-bold text-pin">{c.n}</span>
                    <span className="font-medium"><Bi en={c.title} t={t} inline />.</span> <Bi en={c.detail} t={t} />
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}

      {/* ---------- 3. Measurements ---------- */}
      <section className="page-break mt-10 print:mt-0">
        <PageHead
          title="Points of measurement"
          subtitle={
            <>
              <Bi en="Each code marks a dimension on the measurement guide." t={t} inline />{" "}
              <strong className="text-ink"><Bi en={units === "in" ? "All measures in inches." : "All measures in cm."} t={t} inline /></strong>
            </>
          }
          page={pg()}
          brand={brandName}
          rev={rev}
          t={t}
        />
        {flats && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url(flats.measurementGuide)} alt="Measurement guide" className="print-section mx-auto mb-3 max-h-[110mm] w-full object-contain" />
        )}
        <table className="tp-table text-[10.5px]">
          <thead>
            <tr>
              <th>#</th>
              <th><Bi en="Point of measure" t={t} /></th>
              <th><Bi en="How to measure" t={t} /></th>
              <th className="text-right"><Bi en="Tolerance" t={t} /> ±</th>
              {tp.sizes.map((s) => (
                <th key={s} className={`text-right ${s === tp.baseSize ? "text-ink" : ""}`}>{s}</th>
              ))}
              <th><Bi en="Status" t={t} /></th>
            </tr>
          </thead>
          <tbody>
            {tp.measurements.map((m, i) => (
              <tr key={i}>
                <td className="whitespace-nowrap font-semibold text-pin">{m.code}</td>
                <td><Bi en={m.name} t={t} /></td>
                <td className="text-muted"><Bi en={m.howToMeasure} t={t} /></td>
                <td className="text-right">{M(m.toleranceCm)}</td>
                {m.values.map((v, j) => (
                  <td key={j} className={`whitespace-nowrap text-right tabular-nums ${tp.sizes[j] === tp.baseSize ? "font-semibold" : ""}`}>{M(v)}</td>
                ))}
                <td className="whitespace-nowrap text-[10px]">
                  {(() => {
                    const mm = metaFor(product, m.code);
                    if (mm.verified) return <span className="text-ok"><Bi en="Verified" t={t} /></span>;
                    return (
                      <span className="text-warn-ink">
                        <Bi en={mm.source === "rule" ? "Graded" : mm.source === "edited" ? "Edited" : "To confirm"} t={t} />
                      </span>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ---------- 4. Construction & details ---------- */}
      <section className="page-break mt-10 print:mt-0">
        <PageHead title="Construction & details" page={pg()} brand={brandName} rev={rev} t={t} />
        <table className="tp-table text-[10.5px]">
          <tbody>
            {tp.construction.map((c, i) => (
              <tr key={i}>
                <td className="w-[28%] font-medium"><Bi en={c.area} t={t} /></td>
                <td><Bi en={c.method} t={t} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {pins.length > 0 && (
          <>
            <H t={t}>Detail callouts</H>
            {pinImages.map((img) => (
              <div key={img} className="print-section mb-4 grid grid-cols-[1fr_1.2fr] gap-4">
                <PinnedImage src={url(img)} pins={pins.filter((p) => p.image === img)} />
                <ol className="space-y-1.5 text-[10.5px]">
                  {pins.filter((p) => p.image === img).map((p) => (
                    <li key={p.id}>
                      <span className="mr-1 font-bold text-pin">{p.n}</span>
                      <span className="font-medium"><Bi en={p.title} t={t} inline />.</span> <Bi en={p.note} t={t} />
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            {pins.some((p) => p.closeup) && (
              <div className="print-section grid grid-cols-4 gap-2">
                {pins.filter((p) => p.closeup).map((p) => (
                  <figure key={p.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url(p.closeup!)} alt={p.title} className="aspect-square w-full rounded border border-line object-cover" />
                    <figcaption className="mt-0.5 text-[9px]"><span className="font-bold text-pin">{p.n}</span> {p.title}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </>
        )}

        <div className="grid grid-cols-2 gap-6">
          <div>
            <H t={t}>Care</H>
            <ul className="list-disc pl-4 text-[11px]">
              {tp.careInstructions.map((c, i) => <li key={i}><Bi en={c} t={t} /></li>)}
            </ul>
          </div>
          <div>
            <H t={t}>Costing targets</H>
            <div className="space-y-0.5 text-[11px]">
              <div><Bi en="Factory cost" t={t} inline />: {money(tp.costing.targetFobUsd, cur)}</div>
              <div><Bi en="Retail" t={t} inline />: {money(tp.costing.targetRetailUsd, cur)}</div>
              <div><Bi en="Order size per colour" t={t} inline />: {tp.costing.moqPerColor ?? "—"}</div>
            </div>
          </div>
        </div>
        {tp.openQuestions.length > 0 && (
          <>
            <H t={t}>Open points to confirm with the factory</H>
            <ul className="list-disc pl-4 text-[11px]">
              {tp.openQuestions.map((q, i) => <li key={i}><Bi en={q} t={t} /></li>)}
            </ul>
          </>
        )}
      </section>

      {/* ---------- 5. Prints & labels ---------- */}
      {(prints.length > 0 || labels?.product.file || labels?.hangTag.file) && (
        <section className="page-break mt-10 print:mt-0">
          <PageHead title="Prints, labels & packaging" page={pg()} brand={brandName} rev={rev} t={t} />
          {prints.length > 0 && (
            <>
              <H t={t}>Print specs</H>
              <div className="grid grid-cols-3 gap-3">
                {prints.map((p) => (
                  <figure key={p.id} className="print-section">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url(p.file)} alt={p.name} className="aspect-square w-full rounded border border-line object-cover" />
                    <figcaption className="mt-1 text-[10px]">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-muted">
                        <Bi en={p.kind === "repeat" ? "Seamless repeat" : "Placement"} t={t} inline /> · <Bi en={p.placement} t={t} inline />
                        {p.widthCm || p.heightCm ? ` · ${M(p.widthCm)} × ${M(p.heightCm)} ${units}` : ""}
                      </div>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-4">
            {(["product", "hangTag"] as const).map((slot) =>
              labels?.[slot].file ? (
                <div key={slot} className="print-section">
                  <H t={t}>{slot === "product" ? "Product label" : "Hang tag"}</H>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url(labels[slot].file!)} alt={slot} className="w-full rounded border border-line object-contain" />
                  <div className="mt-1 text-[10px] text-muted">
                    <Bi en="Position" t={t} inline />: <Bi en={labels[slot].position} t={t} inline />
                    {labels[slot].notes ? <> · <Bi en={labels[slot].notes} t={t} inline /></> : null}
                  </div>
                </div>
              ) : null,
            )}
          </div>
          <H t={t}>Labels & packaging spec</H>
          <table className="tp-table text-[10.5px]">
            <tbody>
              {tp.labelsPackaging.map((l, i) => (
                <tr key={i}>
                  <td className="w-[28%] font-medium"><Bi en={l.item} t={t} /></td>
                  <td><Bi en={l.details} t={t} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {(extraImages.length > 0 || refs.length > 0) && (
        <section className="print-section mt-6">
          <H t={t}>Reference images</H>
          <div className="grid grid-cols-6 gap-2">
            {[...extraImages.map((m) => m.file), ...refs].map((f) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={f} src={url(f)} alt="Reference" className="aspect-square w-full rounded border border-line object-cover" />
            ))}
          </div>
        </section>
      )}

      <div className="print-section mt-8 grid grid-cols-2 gap-8 border-t border-line pt-4 text-[10px] text-muted">
        <div><Bi en="Designer approval" t={t} inline />: ______________________ <Bi en="Date" t={t} inline />: ________</div>
        <div><Bi en="Factory approval" t={t} inline />: ______________________ <Bi en="Date" t={t} inline />: ________</div>
      </div>
      <div className="mt-3 text-[9px] uppercase tracking-wider text-muted">
        {brandName || "Tech Pack Studio"} · <Bi en="Confidential" t={t} inline /> ·{" "}
        <Bi en={units === "in" ? "All measures in inches." : "All measures in cm."} t={t} inline />
      </div>
    </div>
  );
}
