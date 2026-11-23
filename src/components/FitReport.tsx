import { Brand, Product, SAMPLE_STAGES, SampleRound, Translation } from "@/lib/schema";
import { isRtl, measure, money, Units } from "@/lib/locale";
import { translator } from "@/lib/translate";
import { scriptFontStack, scriptFontVars } from "@/lib/scriptFonts";
import { Bi } from "./TechPackDocument";
import { sampleRows } from "@/lib/samples";

/**
 * The fit comments sheet for a sample round: what the vendor must fix for the
 * next sample. Printed from the Samples step and shown on the factory link.
 */
export default function FitReport({
  product,
  round,
  brand,
  base,
  units = "cm",
  lang = "en",
  translation = null,
  toolbar,
}: {
  product: Product;
  round: SampleRound;
  brand: Brand;
  base: string;
  units?: Units;
  lang?: string;
  translation?: Translation | null;
  toolbar?: React.ReactNode;
}) {
  const t = translator(lang === "en" ? null : translation);
  const tp = round.snapshot;
  const rows = sampleRows(round).filter((r) => r.got != null);
  const outCount = rows.filter((r) => r.out).length;
  const url = (f: string) => `${base}/files/${f}`;
  const sign = (d: number) => (d > 0 ? "+" : d < 0 ? "−" : "±");
  const verdict =
    round.verdict === "approved" ? "Approved" : round.verdict === "rejected" ? "Rejected" : round.verdict === "revise" ? "Revise and resubmit" : null;

  return (
    <div
      className={`theme-light ${scriptFontVars} mx-auto max-w-[210mm] bg-white px-6 py-6 text-[12px] text-ink print:max-w-none print:p-0`}
      style={{ fontFamily: scriptFontStack }}
      lang={lang}
      dir={isRtl(lang) ? "rtl" : undefined}
    >
      {toolbar}
      <div className="mb-4 flex items-start justify-between gap-6 border-b-2 border-ink pb-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted">{brand.name || "Tech pack"}</div>
          <div className="h-title text-xl">
            <Bi en="Fit comments" t={t} inline /> · <Bi en="Sample" t={t} inline /> {round.n}
          </div>
          <div className="mt-0.5 text-[12px]">
            {tp.styleName} · {tp.styleNumber || "TBC"} · {SAMPLE_STAGES[round.stage]}
          </div>
        </div>
        <div className="text-right text-[11px] leading-relaxed">
          <div><span className="text-muted"><Bi en="Vendor" t={t} inline /></span> {round.vendor || "—"}</div>
          <div><span className="text-muted"><Bi en="Requested" t={t} inline /></span> {new Date(round.requestedAt).toLocaleDateString("en-GB")}</div>
          {round.receivedAt && (
            <div><span className="text-muted"><Bi en="Received" t={t} inline /></span> {new Date(round.receivedAt).toLocaleDateString("en-GB")}</div>
          )}
          <div><span className="text-muted"><Bi en="Sample size" t={t} inline /></span> {round.size}</div>
          {round.sampleCost != null && <div className="text-muted">{money(round.sampleCost, brand.currency)}</div>}
        </div>
      </div>

      {verdict && (
        <div
          className={`mb-4 rounded border px-3 py-2 text-[12.5px] font-semibold ${
            round.verdict === "approved" ? "border-ok text-ok" : round.verdict === "rejected" ? "border-danger text-danger" : "border-warn text-warn-ink"
          }`}
        >
          <Bi en="Verdict" t={t} inline />: <Bi en={verdict} t={t} inline />
        </div>
      )}

      {round.overall && (
        <p className="mb-4 text-[12px] leading-relaxed">
          <span className="font-semibold"><Bi en="Overall" t={t} inline />: </span>
          {round.overall}
        </p>
      )}

      {round.comments.length > 0 && (
        <section className="print-section">
          <h3 className="mb-1.5 border-b border-line pb-1 text-[11px] font-semibold uppercase tracking-wider">
            <Bi en="Fit comments" t={t} inline />
          </h3>
          <table className="tp-table text-[11px]">
            <thead>
              <tr>
                <th>#</th>
                <th><Bi en="Area" t={t} /></th>
                <th><Bi en="Comment" t={t} /></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {round.comments.map((c, i) => (
                <tr key={c.id}>
                  <td className="font-semibold text-pin">{i + 1}</td>
                  <td className="whitespace-nowrap">
                    <Bi en={c.area} t={t} />
                    <div className={`text-[10px] ${c.severity === "major" ? "font-semibold text-danger" : "text-muted"}`}>
                      <Bi en={c.severity === "major" ? "Major" : "Minor"} t={t} inline />
                    </div>
                  </td>
                  <td>{c.text}</td>
                  <td className="w-20">
                    {c.photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url(c.photo)} alt="" className="h-16 w-16 rounded border border-line object-cover" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {rows.length > 0 && (
        <section className="print-section mt-5">
          <h3 className="mb-1.5 border-b border-line pb-1 text-[11px] font-semibold uppercase tracking-wider">
            <Bi en="Points of measurement" t={t} inline /> ({units === "in" ? "in" : "cm"}) ·{" "}
            <span className={outCount ? "text-danger" : "text-ok"}>
              {outCount} <Bi en="Out of tolerance" t={t} inline />
            </span>
          </h3>
          <table className="tp-table text-[11px]">
            <thead>
              <tr>
                <th>#</th>
                <th><Bi en="Point of measure" t={t} /></th>
                <th className="text-right"><Bi en="Spec" t={t} /></th>
                <th className="text-right"><Bi en="Tolerance" t={t} /> ±</th>
                <th className="text-right"><Bi en="Measured" t={t} /></th>
                <th className="text-right"><Bi en="Difference" t={t} /></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code} className={r.out ? "bg-warn-soft" : ""}>
                  <td className="font-semibold text-pin">{r.code}</td>
                  <td><Bi en={r.name} t={t} /></td>
                  <td className="text-right tabular-nums">{measure(r.spec, units)}</td>
                  <td className="text-right tabular-nums">{measure(r.tol, units)}</td>
                  <td className="text-right font-semibold tabular-nums">{measure(r.got, units)}</td>
                  <td className={`whitespace-nowrap text-right font-semibold tabular-nums ${r.out ? "text-danger" : "text-ok"}`}>
                    {r.diff == null ? "—" : `${sign(r.diff)}${measure(Math.abs(r.diff), units)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {round.photos.length > 0 && (
        <section className="print-section mt-5">
          <h3 className="mb-1.5 border-b border-line pb-1 text-[11px] font-semibold uppercase tracking-wider">
            <Bi en="Sample photos" t={t} inline />
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {round.photos.map((p) => (
              <figure key={p.file}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url(p.file)} alt={p.caption || "Sample photo"} className="aspect-square w-full rounded border border-line object-cover" />
                {p.caption && <figcaption className="mt-0.5 text-[10px]">{p.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}

      <div className="print-section mt-8 grid grid-cols-2 gap-8 border-t border-line pt-4 text-[10px] text-muted">
        <div><Bi en="Designer approval" t={t} inline />: ______________________ <Bi en="Date" t={t} inline />: ________</div>
        <div><Bi en="Factory approval" t={t} inline />: ______________________ <Bi en="Date" t={t} inline />: ________</div>
      </div>
      <div className="mt-2 text-[9px] uppercase tracking-wider text-muted">{product.name}</div>
    </div>
  );
}
