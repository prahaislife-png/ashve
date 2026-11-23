"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Check,
  CircleDot,
  FileText,
  ImagePlus,
  PackageCheck,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  COMMENT_AREAS,
  FitComment,
  OutputKey,
  Product,
  SAMPLE_STAGES,
  SampleRound,
  SampleStage,
} from "@/lib/schema";
import { currencyOf, measure, money, parseInches, unitShort } from "@/lib/locale";
import { usePrefs } from "@/lib/prefs";
import { nextStage, sampleRows } from "@/lib/samples";
import { resizePhoto, useAction } from "@/lib/useAction";
import { fileUrl } from "@/lib/urls";
import { COST, Cost, Status } from "@/components/specs/Section";

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");

/**
 * Sample rounds with the vendor: send the tech pack, record what came back
 * (photos, measurements, fit comments), then turn the comments into the next
 * version of the tech pack.
 */
export default function SamplesStep({
  product,
  onUpdate,
  openSpecs,
}: {
  product: Product;
  onUpdate: (p: Product) => void;
  openSpecs: (k: OutputKey) => void;
}) {
  const rounds = product.samples ?? [];
  const [selected, setSelected] = useState<string | null>(rounds.at(-1)?.id ?? null);
  const [creating, setCreating] = useState(rounds.length === 0);
  const round = rounds.find((r) => r.id === selected) ?? rounds.at(-1) ?? null;
  const tp = product.techPack;

  if (!tp) {
    return (
      <div className="flex h-[calc(100vh-57px)] items-center justify-center p-6 text-ink-2">
        Create the tech pack first, then send it for a sample.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h-title text-[26px]">Samples</h1>
          <p className="mt-1 max-w-xl text-[13.5px] text-ink-2">
            Each round: send the tech pack to the vendor, record what comes back, and turn your fit comments into the
            next version of the tech pack.
          </p>
        </div>
        {!creating && rounds.length > 0 && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={15} /> New sample round
          </button>
        )}
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        {/* timeline */}
        <nav aria-label="Sample rounds" className="lg:sticky lg:top-20 lg:self-start">
          {rounds.length === 0 ? (
            <p className="text-[13px] text-muted">No rounds yet.</p>
          ) : (
            <ol className="relative space-y-1 border-l border-line pl-4">
              {rounds.map((r) => {
                const on = !creating && round?.id === r.id;
                return (
                  <li key={r.id} className="relative">
                    <span
                      className={`absolute -left-[22.5px] top-3 h-3 w-3 rounded-full border-2 border-bg ${
                        r.verdict === "approved" ? "bg-ok" : r.status === "requested" ? "bg-line-strong" : r.verdict === "rejected" ? "bg-danger" : "bg-warn"
                      }`}
                      aria-hidden="true"
                    />
                    <button
                      className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${on ? "bg-card shadow-elev-sm" : "hover:bg-panel"}`}
                      aria-current={on ? "true" : undefined}
                      onClick={() => {
                        setSelected(r.id);
                        setCreating(false);
                      }}
                    >
                      <span className="block text-[13.5px] font-medium text-ink">
                        Round {r.n} · {SAMPLE_STAGES[r.stage]}
                      </span>
                      <span className="block truncate text-[12px] text-ink-2">
                        {r.vendor || "Vendor not set"} · {roundLabel(r)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </nav>

        <div className="min-w-0">
          {creating || !round ? (
            <NewRound
              product={product}
              onUpdate={(p) => {
                onUpdate(p);
                setSelected(p.samples?.at(-1)?.id ?? null);
                setCreating(false);
              }}
              onCancel={rounds.length ? () => setCreating(false) : undefined}
            />
          ) : (
            <RoundDetail key={round.id} product={product} round={round} onUpdate={onUpdate} openSpecs={openSpecs} onNext={() => setCreating(true)} />
          )}
        </div>
      </div>
    </div>
  );
}

function roundLabel(r: SampleRound) {
  if (r.verdict === "approved") return "Approved";
  if (r.verdict === "rejected") return "Rejected";
  if (r.status === "reviewed") return r.revision ? "Tech pack updated" : "Reviewed";
  if (r.status === "received") return `Received ${fmtDate(r.receivedAt)}`;
  if (r.dueAt) return `Due ${fmtDate(r.dueAt)}`;
  return `Sent ${fmtDate(r.requestedAt)}`;
}

/* ---------- start a round ---------- */

function NewRound({
  product,
  onUpdate,
  onCancel,
}: {
  product: Product;
  onUpdate: (p: Product) => void;
  onCancel?: () => void;
}) {
  const tp = product.techPack!;
  const rounds = product.samples ?? [];
  const last = rounds.at(-1);
  const [stage, setStage] = useState<SampleStage>(last ? nextStage(last.stage) : "proto");
  const [vendor, setVendor] = useState(last?.vendor ?? "");
  const [dueAt, setDueAt] = useState("");
  const [size, setSize] = useState(tp.baseSize);
  const { run, busy, error } = useAction(onUpdate);
  const vendors = [...new Set(rounds.map((r) => r.vendor).filter(Boolean))];

  return (
    <form
      className="rounded-xl border border-line bg-card p-5 shadow-elev-md"
      onSubmit={(e) => {
        e.preventDefault();
        run(`/api/products/${product.id}/samples`, "POST", { stage, vendor, dueAt, size }, "Starting the round");
      }}
    >
      <h2 className="h-title text-[19px]">Sample round {rounds.length + 1}</h2>
      <p className="mt-0.5 text-[13px] text-ink-2">
        Today&apos;s tech pack is saved as the version this vendor works from, so you can compare the sample against it.
      </p>

      <fieldset className="mt-5">
        <legend className="mb-2 text-[13px] font-medium text-ink">Stage</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SAMPLE_STAGES) as SampleStage[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={stage === s}
              onClick={() => setStage(s)}
              className={`chip ${stage === s ? "border-accent bg-accent-soft text-accent" : ""}`}
            >
              {SAMPLE_STAGES[s]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="block sm:col-span-1">
          <span className="mb-1 block text-[13px] font-medium">Vendor</span>
          <input className="input" list="vendor-names" placeholder="e.g. Shree Knits, Tiruppur" value={vendor} onChange={(e) => setVendor(e.target.value)} />
          <datalist id="vendor-names">
            {vendors.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium">Due back</span>
          <input className="input" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium">Sample size</span>
          <select className="input" value={size} onChange={(e) => setSize(e.target.value)}>
            {tp.sizes.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" disabled={!!busy}>
          <Send size={14} /> Start round {rounds.length + 1}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <span className="text-[12.5px] text-muted">Send the vendor the PDF or factory link from Hand off.</span>
      </div>
      <Status busy={busy} error={error} />
    </form>
  );
}

/* ---------- one round ---------- */

function RoundDetail({
  product,
  round,
  onUpdate,
  openSpecs,
  onNext,
}: {
  product: Product;
  round: SampleRound;
  onUpdate: (p: Product) => void;
  openSpecs: (k: OutputKey) => void;
  onNext: () => void;
}) {
  const { units, currency } = usePrefs();
  const base = `/api/products/${product.id}/samples/${round.id}`;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const revise = useAction(onUpdate);
  const photos = useAction(onUpdate);
  const fileInput = useRef<HTMLInputElement>(null);
  const [comments, setComments] = useState<FitComment[]>(round.comments);
  const [overall, setOverall] = useState(round.overall);
  const [drag, setDrag] = useState(false);

  useEffect(() => setComments(round.comments), [round.comments]);

  async function save(patch: object) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(base, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't save.");
      onUpdate(data as Product);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function addPhotos(files: FileList | File[]) {
    const list = [...files].filter((f) => f.type.startsWith("image/")).slice(0, 12);
    if (!list.length) return;
    const images = await Promise.all(list.map((f) => resizePhoto(f, 1600)));
    await photos.run(`${base}/photos`, "POST", { images }, `Uploading ${list.length} photo${list.length > 1 ? "s" : ""}`);
  }

  function setComment(id: string, change: Partial<FitComment>, persist = false) {
    const next = comments.map((c) => (c.id === id ? { ...c, ...change } : c));
    setComments(next);
    if (persist) save({ comments: next });
  }

  function addComment(area: string) {
    const next = [...comments, { id: crypto.randomUUID(), area, text: "", severity: "minor" as const, photo: null }];
    setComments(next);
    save({ comments: next });
    setTimeout(() => document.getElementById(`comment-${next.at(-1)!.id}`)?.focus(), 60);
  }

  const rows = useMemo(() => sampleRows(round), [round]);
  const measuredCount = rows.filter((r) => r.got != null).length;
  const outCount = rows.filter((r) => r.out).length;
  const overdue = round.status === "requested" && round.dueAt && new Date(round.dueAt) < new Date(new Date().toDateString());
  const canRevise = comments.some((c) => c.text.trim()) || outCount > 0 || overall.trim().length > 0;
  const steps: { key: SampleRound["status"]; label: string }[] = [
    { key: "requested", label: "Sent" },
    { key: "received", label: "Received" },
    { key: "reviewed", label: "Reviewed" },
  ];
  const at = steps.findIndex((s) => s.key === round.status);

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="rounded-xl border border-line bg-card p-5 shadow-elev-md">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] text-muted">Round {round.n}</p>
            <h2 className="h-title text-[22px]">{SAMPLE_STAGES[round.stage]}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
              <label className="flex items-center gap-1.5">
                Vendor
                <input
                  className="input h-7 w-48 py-0.5 text-[13px]"
                  defaultValue={round.vendor}
                  placeholder="Add vendor"
                  onBlur={(e) => e.target.value !== round.vendor && save({ vendor: e.target.value })}
                />
              </label>
              <span>Size {round.size}</span>
              <span>Sent {fmtDate(round.requestedAt)}</span>
              <label className="flex items-center gap-1.5">
                Due
                <input
                  type="date"
                  className={`input h-7 w-auto py-0.5 text-[13px] ${overdue ? "border-warn text-warn-ink" : ""}`}
                  defaultValue={round.dueAt ?? ""}
                  onChange={(e) => save({ dueAt: e.target.value || null })}
                />
              </label>
              {overdue && <span className="text-warn-ink">Overdue</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn" href={`/products/${product.id}/fit/${round.id}?units=${units}`} target="_blank">
              <FileText size={14} /> Fit comments PDF
            </Link>
          </div>
        </div>

        {/* progress */}
        <ol className="mt-5 grid grid-cols-3 gap-2" aria-label="Round progress">
          {steps.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                disabled={saving || i === at}
                onClick={() => save({ status: s.key })}
                className="group w-full text-left"
                aria-current={i === at ? "step" : undefined}
              >
                <span className={`block h-1.5 rounded-full transition-colors ${i <= at ? "bg-accent" : "bg-line"}`} />
                <span className={`mt-1.5 flex items-center gap-1.5 text-[12.5px] ${i <= at ? "text-ink" : "text-muted group-hover:text-ink"}`}>
                  {i < at ? <Check size={13} className="text-accent" /> : i === at ? <CircleDot size={13} className="text-accent" /> : null}
                  {s.label}
                  {s.key === "received" && round.receivedAt && <span className="text-muted">{fmtDate(round.receivedAt)}</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
        {saveError && <p className="mt-3 text-[13px] text-danger">{saveError}</p>}
      </div>

      {/* revision result */}
      {round.revision && (
        <div className="rounded-xl border border-ok/30 bg-ok-soft/70 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ok text-white">
              <Check size={15} strokeWidth={3} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-ink">
                Tech pack updated from these comments, {fmtDate(round.revision.at)}
              </p>
              <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-2">{round.revision.summary}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {round.revision.changed.map((c) => (
                  <button key={c.label} className="chip text-[12px]" onClick={() => openSpecs(c.key === "sizechart" ? "flats" : c.key === "labels" ? "labels" : "basic")}>
                    {c.label}
                  </button>
                ))}
                {round.verdict !== "approved" && (
                  <button className="btn btn-primary ml-auto h-8" onClick={onNext}>
                    <Send size={13} /> Start round {(product.samples?.length ?? 0) + 1}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* photos */}
      <section aria-labelledby="photos-title">
        <div className="mb-2 flex items-end justify-between">
          <h3 id="photos-title" className="h-title text-[17px]">
            Sample photos
          </h3>
          <span className="text-[12.5px] text-muted">{round.photos.length} of 24</span>
        </div>
        <div
          className={`rounded-xl border border-dashed p-3 transition-colors ${drag ? "border-accent bg-accent-soft" : "border-line-strong bg-panel/50"}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            addPhotos(e.dataTransfer.files);
          }}
        >
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {round.photos.map((p) => (
              <li key={p.file} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fileUrl(product.id, p.file)} alt={p.caption || "Sample photo"} className="aspect-square w-full rounded-lg bg-artifact object-cover shadow-elev-sm" />
                <button
                  className="btn absolute right-1.5 top-1.5 h-7 w-7 p-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  aria-label="Remove photo"
                  disabled={!!photos.busy}
                  onClick={() => photos.run(`${base}/photos?file=${encodeURIComponent(p.file)}`, "DELETE", undefined, "Removing")}
                >
                  <Trash2 size={13} />
                </button>
                <input
                  className="mt-1.5 w-full rounded bg-transparent px-1 text-[12px] text-ink-2 outline-none placeholder:text-muted focus:bg-card"
                  placeholder="Caption, e.g. side seam twist"
                  defaultValue={p.caption}
                  onBlur={(e) =>
                    e.target.value !== p.caption &&
                    save({ photos: round.photos.map((x) => (x.file === p.file ? { ...x, caption: e.target.value } : x)) })
                  }
                />
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={!!photos.busy}
                className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-line bg-card text-[12.5px] text-ink-2 transition-colors hover:border-accent hover:text-accent"
              >
                <ImagePlus size={20} />
                Add photos
                <span className="text-[11.5px] text-muted">or drop them here</span>
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </li>
          </ul>
        </div>
        <Status busy={photos.busy} error={photos.error} />
      </section>

      {/* measurements */}
      <section aria-labelledby="measure-title">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 id="measure-title" className="h-title text-[17px]">
              Measurements on the sample
            </h3>
            <p className="text-[12.5px] text-ink-2">
              Size {round.size}, in {unitShort(units)}. Type what you measured; the difference shows against the spec the
              vendor had.
            </p>
          </div>
          <span className={`num rounded-full px-2.5 py-1 text-[12.5px] ${outCount ? "bg-warn-soft text-warn-ink" : "bg-panel text-ink-2"}`}>
            {measuredCount} measured · {outCount} out of tolerance
          </span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="tp-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Point of measure</th>
                <th className="text-right">Spec</th>
                <th className="text-right">Tol ±</th>
                <th className="text-right">Measured</th>
                <th className="text-right">Difference</th>
              </tr>
            </thead>
            <tbody key={units}>
              {rows.map((r) => (
                <tr key={r.code} className={r.out ? "bg-warn-soft/50" : ""}>
                  <td className="code font-medium text-accent">{r.code}</td>
                  <td className="min-w-44 text-ink">{r.name}</td>
                  <td className="num text-right text-ink-2">{measure(r.spec, units)}</td>
                  <td className="num text-right text-muted">{measure(r.tol, units)}</td>
                  <td className="text-right">
                    <input
                      className="tp-num font-medium"
                      inputMode="decimal"
                      aria-label={`${r.name} measured`}
                      placeholder="—"
                      defaultValue={r.got == null ? "" : measure(r.got, units, true)}
                      onBlur={(e) => {
                        if (e.target.value === e.target.defaultValue) return;
                        const raw = e.target.value.trim();
                        const v = raw === "" ? null : units === "in" ? parseInches(raw) : Number(raw);
                        if (raw !== "" && (v == null || Number.isNaN(v))) return;
                        save({ measuredPatch: { [r.code]: v } });
                      }}
                    />
                  </td>
                  <td className="text-right">
                    {r.diff == null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span
                        className={`num inline-block min-w-14 rounded px-1.5 py-px text-[12.5px] font-medium ${
                          r.out ? "bg-warn-soft text-warn-ink" : "bg-ok-soft text-ok"
                        }`}
                        title={r.out ? "Out of tolerance" : "Within tolerance"}
                      >
                        {r.diff > 0 ? "+" : r.diff < 0 ? "−" : "±"}
                        {measure(Math.abs(r.diff), units)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* comments */}
      <section aria-labelledby="comments-title">
        <h3 id="comments-title" className="h-title text-[17px]">
          Fit comments
        </h3>
        <p className="text-[12.5px] text-ink-2">Write them as you would tell the pattern master. Major comments must be fixed in the next sample.</p>
        <ol className="mt-3 space-y-2">
          {comments.map((c, i) => (
            <li key={c.id} className="rounded-xl border border-line bg-card p-3 shadow-elev-sm">
              <div className="flex flex-wrap items-start gap-2">
                <span className="code mt-1.5 w-5 shrink-0 text-right text-[12.5px] font-medium text-accent">{i + 1}</span>
                <select
                  className="input h-8 w-auto py-0.5 text-[13px]"
                  value={c.area}
                  aria-label="Area"
                  onChange={(e) => setComment(c.id, { area: e.target.value }, true)}
                >
                  {COMMENT_AREAS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-pressed={c.severity === "major"}
                  onClick={() => setComment(c.id, { severity: c.severity === "major" ? "minor" : "major" }, true)}
                  className={`chip h-8 ${c.severity === "major" ? "border-danger/40 bg-danger/10 text-danger" : ""}`}
                  title="Major comments must be fixed in the next sample"
                >
                  {c.severity === "major" ? "Major" : "Minor"}
                </button>
                <textarea
                  id={`comment-${c.id}`}
                  rows={1}
                  className="input min-h-8 min-w-48 flex-1 resize-y py-1 text-[13.5px]"
                  placeholder="e.g. Bust 2 cm too tight, release 1 cm each side seam"
                  value={c.text}
                  onChange={(e) => setComment(c.id, { text: e.target.value })}
                  onBlur={() => save({ comments })}
                />
                <button
                  className="btn btn-ghost h-8 w-8 p-0 text-muted hover:text-danger"
                  aria-label="Delete comment"
                  onClick={() => {
                    const next = comments.filter((x) => x.id !== c.id);
                    setComments(next);
                    save({ comments: next });
                  }}
                >
                  <X size={14} />
                </button>
              </div>
              {round.photos.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-7">
                  <Camera size={13} className="text-muted" />
                  {round.photos.map((p) => (
                    <button
                      key={p.file}
                      type="button"
                      aria-pressed={c.photo === p.file}
                      aria-label={c.photo === p.file ? "Unlink photo" : "Link this photo"}
                      onClick={() => setComment(c.id, { photo: c.photo === p.file ? null : p.file }, true)}
                      className={`h-9 w-9 overflow-hidden rounded-md transition ${c.photo === p.file ? "ring-2 ring-accent" : "opacity-60 hover:opacity-100"}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fileUrl(product.id, p.file)} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12.5px] text-ink-2">Add a comment on</span>
          {COMMENT_AREAS.slice(0, 8).map((a) => (
            <button key={a} className="chip text-[12.5px]" onClick={() => addComment(a)}>
              <Plus size={12} /> {a}
            </button>
          ))}
        </div>
      </section>

      {/* verdict */}
      <section aria-labelledby="verdict-title" className="rounded-xl border border-line bg-card p-5 shadow-elev-md">
        <h3 id="verdict-title" className="h-title text-[17px]">
          Verdict
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Verdict">
          {(
            [
              ["approved", "Approved", "Good to go to the next stage"],
              ["revise", "Revise and resubmit", "Another sample with these fixes"],
              ["rejected", "Rejected", "Start again or change vendor"],
            ] as const
          ).map(([v, label, hint]) => {
            const on = round.verdict === v;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => save({ verdict: on ? null : v, status: round.status === "requested" ? "received" : round.status })}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  on
                    ? v === "approved"
                      ? "border-ok bg-ok-soft"
                      : v === "rejected"
                        ? "border-danger bg-danger/10"
                        : "border-warn bg-warn-soft"
                    : "border-line hover:border-line-strong"
                }`}
              >
                <span className="block text-[13.5px] font-medium text-ink">{label}</span>
                <span className="block text-[12.5px] text-ink-2">{hint}</span>
              </button>
            );
          })}
        </div>
        <label className="mt-4 block">
          <span className="mb-1 block text-[13px] font-medium">Overall notes</span>
          <textarea
            className="input min-h-20 text-[13.5px]"
            placeholder="e.g. Good drape, colour matches the lab dip. Fix the bust and strap length, then go to size set."
            value={overall}
            onChange={(e) => setOverall(e.target.value)}
            onBlur={() => overall !== round.overall && save({ overall })}
          />
        </label>
        <label className="mt-3 flex items-center gap-2 text-[13px] text-ink-2">
          Sample charge
          <input
            className="input h-8 w-32 py-0.5"
            inputMode="decimal"
            placeholder={`${currencyOf(currency).symbol}0`}
            defaultValue={round.sampleCost ?? ""}
            onBlur={(e) => {
              const v = e.target.value.trim() === "" ? null : Number(e.target.value.replace(/[^\d.]/g, ""));
              if (v !== round.sampleCost && (v === null || Number.isFinite(v))) save({ sampleCost: v });
            }}
          />
          {round.sampleCost != null && <span className="text-muted">{money(round.sampleCost, currency)}</span>}
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {round.verdict === "approved" ? (
            <>
              <PackageCheck size={18} className="text-ok" />
              <span className="flex-1 text-[13.5px] text-ink">
                Approved.{" "}
                {round.stage === "pp" || round.stage === "top" ? "The style is marked approved." : "Start the next stage when you're ready."}
              </span>
              <button className="btn" onClick={onNext}>
                <Send size={14} /> Next round
              </button>
            </>
          ) : (
            <>
              <span className="min-w-0 flex-1 text-[13px] text-ink-2">
                {canRevise
                  ? "Claude updates the size chart, construction and materials from your comments, and keeps factory mistakes separate from spec changes."
                  : "Add measurements or fit comments, then update the tech pack from them."}
              </span>
              <button
                className="btn btn-primary"
                disabled={!canRevise || !!revise.busy}
                onClick={async () => {
                  await save({ comments, overall });
                  await revise.run(`${base}/revise`, "POST", {}, "Updating the tech pack from the fit comments");
                }}
              >
                <Sparkles size={14} /> {round.revision ? "Update the tech pack again" : "Update the tech pack"} <Cost usd={COST.revise} />
              </button>
            </>
          )}
        </div>
        <Status busy={revise.busy} error={revise.error} />
        <div className="mt-3 flex justify-end">
          <button
            className="text-[12.5px] text-muted hover:text-danger"
            onClick={async () => {
              if (!confirm(`Delete round ${round.n} and its photos? This can't be undone.`)) return;
              const res = await fetch(base, { method: "DELETE" });
              if (res.ok) onUpdate(await res.json());
            }}
          >
            Delete this round
          </button>
        </div>
      </section>
    </div>
  );
}
