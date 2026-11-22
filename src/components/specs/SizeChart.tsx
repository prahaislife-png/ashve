"use client";

import { useMemo, useState } from "react";
import { Check, Download, FileSpreadsheet, Ruler } from "lucide-react";
import { gradeRow, inferGrade, MeasureMeta, metaFor, Product, TechPack } from "@/lib/schema";

type Rows = TechPack["measurements"];

const TAG: Record<MeasureMeta["source"], { label: string; cls: string; title: string }> = {
  ai: {
    label: "AI-suggested",
    cls: "bg-warn-soft text-warn-ink",
    title: "Proposed by the AI. Check it against a sample or your size standard.",
  },
  edited: { label: "Edited", cls: "bg-accent-soft text-ink", title: "You changed these numbers." },
  rule: { label: "Graded", cls: "bg-accent-soft text-ink", title: "Calculated from the sample size and the grade step." },
};

function csv(tp: TechPack, rows: Rows, meta: (code: string) => MeasureMeta) {
  const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const out = [
    ["Code", "Point of measure", "How to measure", "Tolerance ±", "Grade step", ...tp.sizes, "Source", "Verified"],
    ...rows.map((m) => {
      const mm = meta(m.code);
      return [m.code, m.name, m.howToMeasure, m.toleranceCm, mm.grade ?? "", ...m.values, TAG[mm.source].label, mm.verified ? "Yes" : "No"];
    }),
  ];
  return out.map((r) => r.map(esc).join(",")).join("\n");
}

/**
 * The graded size chart with trust cues: every row says where its numbers came
 * from, she ticks rows she has verified, and grade steps calculate every size
 * from the sample size instead of trusting AI guesses.
 */
export default function SizeChart({
  product,
  run,
  busy,
  slug,
}: {
  product: Product;
  run: (url: string, method: string, body?: object, label?: string) => Promise<boolean>;
  busy: string | null;
  slug: string;
}) {
  const tp = product.techPack!;
  const baseIndex = Math.max(0, tp.sizes.indexOf(tp.baseSize));
  const [rows, setRows] = useState<Rows | null>(null);
  const [meta, setMeta] = useState<Record<string, MeasureMeta> | null>(null);
  const [reset, setReset] = useState(0); // remounts the inputs after grading or discard

  const current = rows ?? tp.measurements;
  const metaOf = (code: string) => meta?.[code] ?? metaFor(product, code);
  const dirty = useMemo(
    () => (rows && JSON.stringify(rows) !== JSON.stringify(tp.measurements)) || meta !== null,
    [rows, meta, tp],
  );
  const verified = current.filter((m) => metaOf(m.code).verified).length;

  function patchMeta(code: string, change: Partial<MeasureMeta>) {
    setMeta((prev) => ({ ...(prev ?? {}), [code]: { ...metaOf(code), ...change } }));
  }

  function setCell(r: number, c: number | "tol", raw: string) {
    const v = raw.trim() === "" ? null : Number(raw);
    if (v !== null && Number.isNaN(v)) return;
    const row = current[r];
    const next =
      c === "tol"
        ? { ...row, toleranceCm: v ?? 0 }
        : { ...row, values: row.values.map((x, j) => (j === c ? v : x)) };
    if (JSON.stringify(next) === JSON.stringify(row)) return;
    setRows(current.map((m, i) => (i === r ? next : m)));
    if (c !== "tol") patchMeta(row.code, { source: "edited", verified: false });
  }

  function setGrade(code: string, raw: string) {
    const v = raw.trim() === "" ? null : Number(raw);
    if (v !== null && Number.isNaN(v)) return;
    patchMeta(code, { grade: v });
  }

  /** Recalculate every size from the sample size using each row's grade step. */
  function gradeAll() {
    const next = current.map((m) => {
      const step = metaOf(m.code).grade ?? inferGrade(m.values);
      return step == null ? m : { ...m, values: gradeRow(m.values, baseIndex, step) };
    });
    const nextMeta: Record<string, MeasureMeta> = { ...(meta ?? {}) };
    for (const m of current) {
      const mm = metaOf(m.code);
      const step = mm.grade ?? inferGrade(m.values);
      if (step == null) continue;
      const graded = gradeRow(m.values, baseIndex, step);
      const changed = JSON.stringify(graded) !== JSON.stringify(m.values);
      nextMeta[m.code] = { ...mm, grade: step, source: "rule", verified: changed ? false : mm.verified };
    }
    setRows(next);
    setMeta(nextMeta);
    setReset((n) => n + 1);
  }

  async function save() {
    const body: Record<string, unknown> = {};
    if (rows && JSON.stringify(rows) !== JSON.stringify(tp.measurements)) body.techPack = { ...tp, measurements: rows };
    if (meta) body.measureMeta = meta;
    if (await run(`/api/products/${product.id}`, "PATCH", body, "Saving the size chart")) {
      setRows(null);
      setMeta(null);
      setReset((n) => n + 1);
    }
  }

  async function toggleVerified(code: string, value: boolean) {
    if (dirty) return patchMeta(code, { verified: value });
    await run(
      `/api/products/${product.id}`,
      "PATCH",
      { measureMeta: { [code]: { ...metaFor(product, code), verified: value } } },
      "Saving",
    );
  }

  async function verifyAll() {
    const all: Record<string, MeasureMeta> = {};
    for (const m of current) all[m.code] = { ...metaOf(m.code), verified: true };
    if (dirty) return setMeta((prev) => ({ ...(prev ?? {}), ...all }));
    await run(`/api/products/${product.id}`, "PATCH", { measureMeta: all }, "Saving");
  }

  return (
    <div>
      {/* Trust summary */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-panel px-4 py-3 text-[13px]">
        <span className="num font-medium text-ink">
          {verified} of {current.length} rows verified
        </span>
        <span className="flex items-center gap-1.5 text-ink-2">
          <span className="rounded px-1.5 py-px text-[11.5px] bg-warn-soft text-warn-ink">AI-suggested</span> check before
          sampling
        </span>
        <span className="flex items-center gap-1.5 text-ink-2">
          <span className="rounded bg-accent-soft px-1.5 py-px text-[11.5px] text-ink">Graded</span> from sample size{" "}
          <span className="code">{tp.baseSize}</span>
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className="btn" disabled={!!busy} onClick={gradeAll} title="Use each row's grade step to recalculate every size from the sample size">
          <Ruler size={14} /> Grade all from {tp.baseSize}
        </button>
        <button className="btn" disabled={!!busy || verified === current.length} onClick={verifyAll}>
          <Check size={14} /> Mark all verified
        </button>
        <div className="flex-1" />
        {dirty ? (
          <>
            <button
              className="btn"
              onClick={() => {
                setRows(null);
                setMeta(null);
                setReset((n) => n + 1);
              }}
            >
              Discard
            </button>
            <button className="btn btn-primary" disabled={!!busy} onClick={save}>
              Save size chart
            </button>
          </>
        ) : (
          <>
            <a className="btn" href={`/api/products/${product.id}/excel`}>
              <FileSpreadsheet size={14} /> Excel
            </a>
            <button
              className="btn"
              onClick={() => {
                const blob = new Blob([csv(tp, current, metaOf)], { type: "text/csv" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${slug}-measurements.csv`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              <Download size={14} /> CSV
            </button>
          </>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="tp-table" key={`${product.updatedAt}-${reset}`}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Point of measure</th>
              <th className="text-right">Tol ±</th>
              <th className="text-right" title="Change between neighbouring sizes, in cm">
                Grade
              </th>
              {tp.sizes.map((s) => (
                <th key={s} className={`text-right ${s === tp.baseSize ? "text-accent" : ""}`}>
                  {s}
                </th>
              ))}
              <th>Source</th>
              <th className="text-center">Verified</th>
            </tr>
          </thead>
          <tbody>
            {current.map((m, r) => {
              const mm = metaOf(m.code);
              const tag = TAG[mm.source];
              const shownGrade = mm.grade ?? inferGrade(m.values);
              return (
                <tr key={m.code}>
                  <td className="code whitespace-nowrap font-medium text-accent">{m.code}</td>
                  <td className="min-w-48">
                    <div className="text-ink">{m.name}</div>
                    <div className="text-[12px] text-muted">{m.howToMeasure}</div>
                  </td>
                  <td className="text-right">
                    <input
                      className="tp-num"
                      inputMode="decimal"
                      defaultValue={m.toleranceCm}
                      aria-label={`${m.name} tolerance`}
                      onBlur={(e) => setCell(r, "tol", e.target.value)}
                    />
                  </td>
                  <td className="text-right">
                    <input
                      className={`tp-num ${mm.grade == null ? "text-muted" : ""}`}
                      inputMode="decimal"
                      defaultValue={shownGrade ?? ""}
                      aria-label={`${m.name} grade step`}
                      title={mm.grade == null ? "Read from the current numbers. Type a value to set it." : "Your grade step"}
                      onBlur={(e) => {
                        if (e.target.value !== String(shownGrade ?? "")) setGrade(m.code, e.target.value);
                      }}
                    />
                  </td>
                  {tp.sizes.map((s, c) => (
                    <td key={s} className={`text-right ${c === baseIndex ? "bg-accent-soft/40" : ""}`}>
                      <input
                        className={`tp-num ${c === baseIndex ? "font-medium" : ""}`}
                        inputMode="decimal"
                        defaultValue={m.values[c] ?? ""}
                        aria-label={`${m.name} size ${s}`}
                        onBlur={(e) => setCell(r, c, e.target.value)}
                      />
                    </td>
                  ))}
                  <td>
                    <span className={`whitespace-nowrap rounded px-1.5 py-px text-[11.5px] ${tag.cls}`} title={tag.title}>
                      {tag.label}
                    </span>
                  </td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-[var(--ok)]"
                      checked={mm.verified}
                      disabled={!!busy}
                      aria-label={`${m.name} verified`}
                      onChange={(e) => toggleVerified(m.code, e.target.checked)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12.5px] text-muted">
        All measurements in cm. Click a number to change it. Grading keeps the sample size ({tp.baseSize}) and calculates
        the other sizes from each row&apos;s grade step. Changed rows lose their verified tick until you check them again.
      </p>
    </div>
  );
}
