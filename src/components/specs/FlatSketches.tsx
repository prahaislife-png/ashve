"use client";

import { useMemo, useState } from "react";
import { Download, PencilLine, RefreshCw, Wand2 } from "lucide-react";
import { Product, TechPack } from "@/lib/schema";
import { fileUrl } from "@/lib/urls";
import { useAction } from "@/lib/useAction";
import { COST, Cost, Section, Status, Tabs } from "./Section";

type Tab = "flats" | "pom" | "technical" | "coloured";

function Drawing({ src, label, download }: { src: string; label: string; download?: string }) {
  return (
    <figure className="artifact p-2">
      <a href={src} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} className="aspect-[4/3] w-full object-contain" />
      </a>
      <figcaption className="mt-1 flex items-center justify-between px-1 text-[12.5px] text-[#4b5260]">
        <span className="font-medium">{label}</span>
        {download && (
          <a className="flex items-center gap-1 text-[#2f55a3] hover:underline" href={src} download={download}>
            <Download size={12} /> SVG
          </a>
        )}
      </figcaption>
    </figure>
  );
}

function measurementsCsv(tp: TechPack) {
  const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["Code", "Point of measure", "How to measure", "Tolerance ±", ...tp.sizes],
    ...tp.measurements.map((m) => [m.code, m.name, m.howToMeasure, m.toleranceCm, ...m.values]),
  ];
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

export default function FlatSketches({ product, onUpdate }: { product: Product; onUpdate: (p: Product) => void }) {
  const tp = product.techPack!;
  const [tab, setTab] = useState<Tab>("flats");
  const [instruction, setInstruction] = useState("");
  const [colour, setColour] = useState(tp.colorways[0]?.hex ?? "#d8cfbf");
  const { run, busy, error, job } = useAction(onUpdate);

  const sets = product.flats ?? [];
  const current = sets.at(-1);
  const older = sets.slice(0, -1).reverse();
  const slug = (tp.styleNumber && tp.styleNumber !== "TBC" ? tp.styleNumber : product.name).replace(/[^\w-]+/g, "_");
  const url = (f: string) => fileUrl(product.id, f);

  // Editable size chart
  const [draft, setDraft] = useState<TechPack["measurements"] | null>(null);
  const rows = draft ?? tp.measurements;
  const dirty = useMemo(() => draft && JSON.stringify(draft) !== JSON.stringify(tp.measurements), [draft, tp]);

  function setCell(r: number, c: number | "tol", raw: string) {
    const v = raw.trim() === "" ? null : Number(raw);
    if (v !== null && Number.isNaN(v)) return;
    setDraft(
      rows.map((m, i) =>
        i !== r
          ? m
          : c === "tol"
            ? { ...m, toleranceCm: v ?? 0 }
            : { ...m, values: m.values.map((x, j) => (j === c ? v : x)) },
      ),
    );
  }

  const drawLabel = current ? "Redrawing… about 2–4 minutes" : "Drawing front, back and measurement guide… about 2–4 minutes";

  return (
    <Section
      id="flats"
      title="Flat sketches"
      subtitle="Technical flats, the measurement guide and construction callouts for the sample room"
      badge={current ? <span className="badge-ok">Ready</span> : null}
    >
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "flats", label: "Flats" },
          { key: "pom", label: "Points of measure" },
          { key: "technical", label: "Technical sketch" },
          { key: "coloured", label: "Coloured sketch" },
        ]}
      />

      <div className="mt-4">
        {!current && tab !== "pom" ? (
          <div className="drafting-grid flex flex-wrap items-center justify-between gap-3 rounded-xl px-5 py-6 shadow-elev-sm">
            <div className="flex items-center gap-3">
              <PencilLine size={18} className="text-[#2f55a3]" />
              <div>
                <div className="font-medium text-[#1f2430]">Draw the technical flats</div>
                <div className="text-[13px] text-[#4b5260]">
                  Front, back and a measurement guide, drawn to your sample-size measurements
                </div>
              </div>
            </div>
            <button
              className="btn btn-primary"
              disabled={!!busy}
              onClick={() => run(`/api/products/${product.id}/flats`, "POST", {}, drawLabel)}
            >
              <Wand2 size={14} /> Draw flats <Cost usd={COST.flats} />
            </button>
          </div>
        ) : null}

        {tab === "flats" && current && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Drawing src={url(current.front)} label="Front" download={`${slug}-front.svg`} />
              <Drawing src={url(current.back)} label="Back" download={`${slug}-back.svg`} />
            </div>
            {current.note && <p className="mt-2 text-xs text-muted">{current.note}</p>}
            <form
              className="mt-3 flex flex-col gap-2 sm:flex-row"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await run(`/api/products/${product.id}/flats`, "POST", { instruction }, drawLabel)) setInstruction("");
              }}
            >
              <input
                className="input"
                placeholder="Optional fix, e.g. “sleeves are too short” or “add the side splits”"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
              />
              <button className="btn" disabled={!!busy}>
                <RefreshCw size={14} /> {instruction.trim() ? "Fix drawing" : "Redraw from tech pack"} <Cost usd={COST.flats} />
              </button>
            </form>
            {older.length > 0 && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-muted">Earlier drawings ({older.length})</summary>
                <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {older.map((s) => (
                    <li key={s.id} className="artifact p-1 text-xs text-[#4b5260]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url(s.front)} alt="Earlier front flat" className="aspect-square w-full object-contain" />
                      <div className="mt-1 flex justify-between">
                        <button className="text-accent hover:underline" disabled={!!busy} onClick={() => run(`/api/products/${product.id}/flats/${s.id}`, "PATCH")}>
                          Use
                        </button>
                        <button
                          className="text-danger hover:underline"
                          disabled={!!busy}
                          onClick={() => confirm("Delete this drawing set?") && run(`/api/products/${product.id}/flats/${s.id}`, "DELETE")}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}

        {tab === "pom" && (
          <div>
            {current && (
              <div className="mb-4">
                <Drawing src={url(current.measurementGuide)} label="Measurement guide" download={`${slug}-measurement-guide.svg`} />
              </div>
            )}
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted">All measurements in cm. Click a number to correct it.</p>
              <div className="flex gap-2">
                {dirty && (
                  <>
                    <button className="btn" onClick={() => setDraft(null)}>Discard</button>
                    <button
                      className="btn btn-primary"
                      disabled={!!busy}
                      onClick={async () => {
                        if (await run(`/api/products/${product.id}`, "PATCH", { techPack: { ...tp, measurements: rows } }, "Saving…")) setDraft(null);
                      }}
                    >
                      Save edits
                    </button>
                  </>
                )}
                <button
                  className="btn"
                  onClick={() => {
                    const blob = new Blob([measurementsCsv(tp)], { type: "text/csv" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `${slug}-measurements.csv`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                >
                  <Download size={14} /> CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="tp-table" key={product.updatedAt}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Point of measure</th>
                    <th>How to measure</th>
                    <th className="text-right">Tol ±</th>
                    {tp.sizes.map((s) => (
                      <th key={s} className={`text-right ${s === tp.baseSize ? "text-accent" : ""}`}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m, r) => (
                    <tr key={r}>
                      <td className="code whitespace-nowrap font-medium text-accent">{m.code}</td>
                      <td>{m.name}</td>
                      <td className="text-muted">{m.howToMeasure}</td>
                      <td className="text-right">
                        <input className="tp-num" inputMode="decimal" defaultValue={m.toleranceCm} aria-label={`${m.name} tolerance`} onBlur={(e) => setCell(r, "tol", e.target.value)} />
                      </td>
                      {tp.sizes.map((s, c) => (
                        <td key={s} className="text-right">
                          <input className="tp-num" inputMode="decimal" defaultValue={m.values[c] ?? ""} aria-label={`${m.name} size ${s}`} onBlur={(e) => setCell(r, c, e.target.value)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "technical" && current && (
          <div>
            {current.technical ? (
              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <Drawing src={url(current.technical)} label="Technical sketch – front" download={`${slug}-technical.svg`} />
                <ol className="space-y-2 text-sm">
                  {(current.technicalNotes ?? []).map((c) => (
                    <li key={c.n} className="flex gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accent text-[11px] font-semibold text-accent">{c.n}</span>
                      <span>
                        <span className="font-medium">{c.title}.</span> <span className="text-muted">{c.detail}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="text-sm text-muted">Numbered construction callouts on the front flat, for the sample room.</p>
            )}
            <button
              className="btn btn-primary mt-3"
              disabled={!!busy}
              onClick={() => run(`/api/products/${product.id}/flats/technical`, "POST", {}, "Adding construction callouts… about 1–3 minutes")}
            >
              <Wand2 size={14} /> {current.technical ? "Redo technical sketch" : "Add construction callouts"}{" "}
              <Cost usd={COST.technical} />
            </button>
          </div>
        )}

        {tab === "coloured" && current && (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {tp.colorways.map((c) => (
                <button
                  key={c.name}
                  className="chip" aria-pressed={colour === c.hex}
                  onClick={() => setColour(c.hex)}
                >
                  <span className="h-3.5 w-3.5 rounded-full border border-line" style={{ background: c.hex }} />
                  {c.name}
                </button>
              ))}
              <label className="chip">
                <input type="color" className="h-4 w-5 cursor-pointer" value={/^#[0-9a-f]{6}$/i.test(colour) ? colour : "#d8cfbf"} onChange={(e) => setColour(e.target.value)} aria-label="Custom colour" />
                Try a colour
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["front", "back"] as const).map((side) => (
                <Drawing
                  key={side}
                  src={`/api/products/${product.id}/flats/colored?side=${side}&hex=${colour.replace("#", "")}&v=${current.id}`}
                  label={`Coloured – ${side}`}
                  download={`${slug}-coloured-${side}.svg`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <Status busy={busy} error={error} job={job} />
    </Section>
  );
}
