import { notFound } from "next/navigation";
import { getBrand, getProduct } from "@/lib/store";
import PrintButton from "@/components/PrintButton";
import { PinnedImage } from "@/components/specs/DetailedSpecs";
import { MOCKUP_VIEWS, PRODUCT_VIEWS, productViews } from "@/lib/schema";
import { fileUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

function PageHead({ title, subtitle, page, brand, rev }: { title: string; subtitle?: string; page: string; brand: string; rev: number }) {
  return (
    <div className="mb-4 flex items-start justify-between border-b-2 border-ink pb-2">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted">{brand || "Tech pack"}</div>
        <div className="h-title text-lg">{title}</div>
        {subtitle && <div className="text-[11px] text-muted">{subtitle}</div>}
      </div>
      <div className="text-right text-[10px] text-muted">
        <div>{page}</div>
        <div>Revision {rev}</div>
      </div>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1.5 mt-4 border-b border-line pb-1 text-[11px] font-semibold uppercase tracking-wider">{children}</h3>;
}

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, brand] = await Promise.all([getProduct(id).catch(() => null), getBrand()]);
  if (!product?.techPack) notFound();
  const tp = product.techPack;
  const url = (f: string) => fileUrl(product.id, f);
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
    <div className="theme-light mx-auto max-w-[210mm] bg-white px-6 py-6 text-[12px] text-ink print:max-w-none print:p-0">
      <div className="no-print mb-6 flex items-center justify-between rounded-lg bg-accent-soft p-3 text-sm">
        <span>In the print window choose “Save as PDF”. Turn on “Background graphics” for colour swatches.</span>
        <PrintButton />
      </div>

      {/* ---------- 1. Overview ---------- */}
      <section>
        <div className="mb-4 flex items-start justify-between gap-6 border-b-2 border-ink pb-3">
          <div className="max-w-[60%]">
            <div className="h-title text-xl">{tp.styleName}</div>
            <p className="mt-1 text-[11px] leading-snug text-muted">{tp.description}</p>
            <div className="mt-1 text-[10px] font-semibold">REVISION: {rev}</div>
          </div>
          <div className="text-right text-[11px] leading-relaxed">
            <div className="text-[10px] text-muted">{pg()}</div>
            <div><span className="text-muted">Style no.</span> {tp.styleNumber || "TBC"}</div>
            <div><span className="text-muted">Category</span> {tp.category}</div>
            <div><span className="text-muted">Sub-category</span> {tp.subcategory}</div>
            <div><span className="text-muted">Season</span> {tp.season || "—"}</div>
            <div><span className="text-muted">Designer</span> {brandName || "—"}</div>
            <div><span className="text-muted">Issued</span> {new Date(product.updatedAt).toLocaleDateString()}</div>
          </div>
        </div>

        {Object.keys(views).length > 0 && (
          <div className="print-section grid grid-cols-3 gap-3">
            {PRODUCT_VIEWS.map((v) => (
              <figure key={v} className="rounded border border-line p-1.5">
                <figcaption className="mb-1 text-[9px] uppercase tracking-wider text-muted">{v.replace("product-", "")}</figcaption>
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
            <H>Product summary</H>
            <dl className="space-y-1 text-[11px]">
              {[
                ["Category", `${tp.category} / ${tp.subcategory}`],
                ["Product type", tp.productType],
                ["Fit", tp.fit],
                ["Intended use", tp.intendedUse],
                ["Target market", tp.targetMarket],
                ["Sizes", `${tp.sizes.join(", ")} (sample ${tp.baseSize})`],
                ["Est. weight", tp.estimatedWeightG ? `${tp.estimatedWeightG} g (size M)` : "—"],
                ["Pattern", tp.pattern || "—"],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[90px_1fr] gap-2">
                  <dt className="text-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <H>Colourway</H>
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
                <H>Secondary colours</H>
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
            <H>Bill of materials</H>
            <table className="tp-table text-[10.5px]">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Material</th>
                  <th>Spec</th>
                </tr>
              </thead>
              <tbody>
                {tp.fabrics.map((f, i) => (
                  <tr key={`f${i}`}>
                    <td className="font-medium">{f.placement}</td>
                    <td>{f.composition}, {f.construction}</td>
                    <td>{[f.weightGsm && `${f.weightGsm} GSM`, f.finish].filter(Boolean).join(", ")}</td>
                  </tr>
                ))}
                {tp.trims.map((t, i) => (
                  <tr key={`t${i}`}>
                    <td className="font-medium">{t.item}</td>
                    <td>{t.description}</td>
                    <td>{t.placement} · {t.quantity}</td>
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
          <PageHead title="Flat sketches" subtitle="Technical flats drawn to the sample size" page={pg()} brand={brandName} rev={rev} />
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
                  <figcaption className="text-[9px] uppercase tracking-wider text-muted">Coloured sketch – {side} – {tp.colorways[0].name}</figcaption>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/products/${product.id}/flats/colored?side=${side}&hex=${tp.colorways[0].hex.replace("#", "")}`} alt={`Coloured ${side}`} className="aspect-[4/3] w-full object-contain" />
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
                    <span className="font-medium">{c.title}.</span> {c.detail}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}

      {/* ---------- 3. Measurements ---------- */}
      <section className="page-break mt-10 print:mt-0">
        <PageHead title="Points of measurement" subtitle="Each code marks a dimension on the measurement guide. All measures in cm." page={pg()} brand={brandName} rev={rev} />
        {flats && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url(flats.measurementGuide)} alt="Measurement guide" className="print-section mx-auto mb-3 max-h-[110mm] w-full object-contain" />
        )}
        <table className="tp-table text-[10.5px]">
          <thead>
            <tr>
              <th>#</th>
              <th>Point of measure</th>
              <th>How to measure</th>
              <th className="text-right">Tol ±</th>
              {tp.sizes.map((s) => (
                <th key={s} className={`text-right ${s === tp.baseSize ? "text-ink" : ""}`}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tp.measurements.map((m, i) => (
              <tr key={i}>
                <td className="whitespace-nowrap font-semibold text-pin">{m.code}</td>
                <td>{m.name}</td>
                <td className="text-muted">{m.howToMeasure}</td>
                <td className="text-right">{m.toleranceCm}</td>
                {m.values.map((v, j) => (
                  <td key={j} className={`text-right tabular-nums ${tp.sizes[j] === tp.baseSize ? "font-semibold" : ""}`}>{v ?? "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ---------- 4. Construction & details ---------- */}
      <section className="page-break mt-10 print:mt-0">
        <PageHead title="Construction & details" page={pg()} brand={brandName} rev={rev} />
        <table className="tp-table text-[10.5px]">
          <tbody>
            {tp.construction.map((c, i) => (
              <tr key={i}>
                <td className="w-[28%] font-medium">{c.area}</td>
                <td>{c.method}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {pins.length > 0 && (
          <>
            <H>Detail callouts</H>
            {pinImages.map((img) => (
              <div key={img} className="print-section mb-4 grid grid-cols-[1fr_1.2fr] gap-4">
                <PinnedImage src={url(img)} pins={pins.filter((p) => p.image === img)} />
                <ol className="space-y-1.5 text-[10.5px]">
                  {pins.filter((p) => p.image === img).map((p) => (
                    <li key={p.id}>
                      <span className="mr-1 font-bold text-pin">{p.n}</span>
                      <span className="font-medium">{p.title}.</span> {p.note}
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
            <H>Care</H>
            <ul className="list-disc pl-4 text-[11px]">
              {tp.careInstructions.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
          <div>
            <H>Costing targets</H>
            <div className="text-[11px]">
              FOB {tp.costing.targetFobUsd != null ? `$${tp.costing.targetFobUsd}` : "—"} · Retail{" "}
              {tp.costing.targetRetailUsd != null ? `$${tp.costing.targetRetailUsd}` : "—"} · MOQ/colour {tp.costing.moqPerColor ?? "—"}
            </div>
          </div>
        </div>
        {tp.openQuestions.length > 0 && (
          <>
            <H>Open points to confirm with the factory</H>
            <ul className="list-disc pl-4 text-[11px]">
              {tp.openQuestions.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </>
        )}
      </section>

      {/* ---------- 5. Prints & labels ---------- */}
      {(prints.length > 0 || labels?.product.file || labels?.hangTag.file) && (
        <section className="page-break mt-10 print:mt-0">
          <PageHead title="Prints, labels & packaging" page={pg()} brand={brandName} rev={rev} />
          {prints.length > 0 && (
            <>
              <H>Print specs</H>
              <div className="grid grid-cols-3 gap-3">
                {prints.map((p) => (
                  <figure key={p.id} className="print-section">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url(p.file)} alt={p.name} className="aspect-square w-full rounded border border-line object-cover" />
                    <figcaption className="mt-1 text-[10px]">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-muted">
                        {p.kind === "repeat" ? "Seamless repeat" : "Placement"} · {p.placement}
                        {p.widthCm || p.heightCm ? ` · ${p.widthCm ?? "?"} × ${p.heightCm ?? "?"} cm` : ""}
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
                  <H>{slot === "product" ? "Product label" : "Hang tag"}</H>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url(labels[slot].file!)} alt={slot} className="w-full rounded border border-line object-contain" />
                  <div className="mt-1 text-[10px] text-muted">
                    Position: {labels[slot].position}
                    {labels[slot].notes ? ` · ${labels[slot].notes}` : ""}
                  </div>
                </div>
              ) : null,
            )}
          </div>
          <H>Labels & packaging spec</H>
          <table className="tp-table text-[10.5px]">
            <tbody>
              {tp.labelsPackaging.map((l, i) => (
                <tr key={i}>
                  <td className="w-[28%] font-medium">{l.item}</td>
                  <td>{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {(extraImages.length > 0 || refs.length > 0) && (
        <section className="print-section mt-6">
          <H>Reference images</H>
          <div className="grid grid-cols-6 gap-2">
            {[...extraImages.map((m) => m.file), ...refs].map((f) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={f} src={url(f)} alt="Reference" className="aspect-square w-full rounded border border-line object-cover" />
            ))}
          </div>
        </section>
      )}

      <div className="print-section mt-8 grid grid-cols-2 gap-8 border-t border-line pt-4 text-[10px] text-muted">
        <div>Designer approval: ______________________ Date: ________</div>
        <div>Factory approval: ______________________ Date: ________</div>
      </div>
      <div className="mt-3 text-[9px] uppercase tracking-wider text-muted">
        {brandName || "Tech Pack Studio"} · Confidential · All measures in cm
      </div>
    </div>
  );
}
