"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  CircleAlert,
  Copy,
  ExternalLink,
  FileArchive,
  FileSpreadsheet,
  FileText,
  ImagePlus,
  Info,
  Link2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Collection, CollectionFabric, CollectionStatus, PlanItem, SAMPLE_STAGES } from "@/lib/schema";
import { collectionChecks, daysToLaunch, LineRow, lineRows, margin, paletteIndex, PieceSummary } from "@/lib/collectionMath";
import { currencyOf, money } from "@/lib/locale";
import { usePrefs } from "@/lib/prefs";
import { resizePhoto } from "@/lib/useAction";
import { fileUrl } from "@/lib/urls";
import { PENDING_KEY } from "@/components/CreateBox";
import { COST, Cost } from "@/components/specs/Section";

type Data = { collection: Collection; pieces: PieceSummary[] };
type Tab = "plan" | "colour" | "costing" | "checks";

const STATUSES: { key: CollectionStatus; label: string }[] = [
  { key: "planning", label: "Planning" },
  { key: "developing", label: "Developing" },
  { key: "sampling", label: "Sampling" },
  { key: "ready", label: "Ready for production" },
  { key: "launched", label: "Launched" },
];

const CATEGORIES = ["Tops", "Bottoms", "Sets", "Dresses", "Sleepwear", "Layers", "Bras & bralettes", "Accessories"];

/**
 * The collection workspace: details and story, the line plan board, colour and
 * fabric planning, costing, consistency checks, and every export for the drop.
 */
export default function CollectionBoard({ initial }: { initial: Data }) {
  const router = useRouter();
  const [data, setData] = useState<Data>(initial);
  const [tab, setTab] = useState<Tab>("plan");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const { units, currency } = usePrefs();
  const c = data.collection;
  const rows = useMemo(() => lineRows(c, data.pieces), [c, data.pieces]);
  const checks = useMemo(() => collectionChecks(c, rows), [c, rows]);
  const days = daysToLaunch(c);

  async function call(url: string, method: string, body?: object, label = "Saving") {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error ?? "Something went wrong.");
      return out;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function patch(change: Partial<Collection>) {
    setData((d) => ({ ...d, collection: { ...d.collection, ...change } }));
    const out = await call(`/api/collections/${c.id}`, "PATCH", change);
    if (out) setData(out);
  }

  async function pieces(body: object, label: string) {
    const out = await call(`/api/collections/${c.id}/pieces`, "POST", body, label);
    if (out) setData({ collection: out.collection, pieces: out.pieces });
    return out;
  }

  async function start(plan: PlanItem) {
    const out = await pieces({ action: "start", planId: plan.id }, `Starting ${plan.name}`);
    if (out?.brief) {
      try {
        sessionStorage.setItem(PENDING_KEY(out.brief.productId), JSON.stringify({ text: out.brief.text, photos: [] }));
      } catch {
        // ignore
      }
      router.push(`/products/${out.brief.productId}?step=design`);
    }
  }

  const stats = {
    planned: rows.length,
    started: rows.filter((r) => r.piece).length,
    packs: rows.filter((r) => r.piece?.hasTechPack).length,
    sampling: rows.filter((r) => r.piece?.lastSample && r.piece.status !== "approved").length,
    approved: rows.filter((r) => r.piece?.status === "approved").length,
  };
  const margins = rows.map((r) => margin(r.cost, r.retail)).filter((m): m is number => m != null);
  const avgMargin = margins.length ? Math.round(margins.reduce((a, b) => a + b, 0) / margins.length) : null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <Link href="/collections" className="inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">
        <ChevronLeft size={14} /> Collections
      </Link>

      {/* ---------- header ---------- */}
      <div className="mt-2 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <input
            key={c.name}
            className="h-title w-full rounded-md bg-transparent px-1 py-0.5 text-[32px] leading-tight text-ink outline-none hover:bg-panel focus:bg-card"
            defaultValue={c.name}
            aria-label="Collection name"
            onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && patch({ name: e.target.value })}
          />
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-[13px] text-ink-2">
            <label className="flex items-center gap-1.5">
              Season
              <input className="input h-7 w-24 py-0.5 text-[13px]" defaultValue={c.season} placeholder="SS27" onBlur={(e) => e.target.value !== c.season && patch({ season: e.target.value })} />
            </label>
            <label className="flex items-center gap-1.5">
              <CalendarDays size={14} className="text-muted" /> Launch
              <input type="date" className="input h-7 w-auto py-0.5 text-[13px]" defaultValue={c.launchDate ?? ""} onChange={(e) => patch({ launchDate: e.target.value || null })} />
            </label>
            {days != null && (
              <span className={`num rounded-full px-2 py-0.5 text-[12px] ${days < 0 ? "bg-panel text-muted" : days <= 30 ? "bg-warn-soft text-warn-ink" : "bg-accent-soft text-accent"}`}>
                {days < 0 ? `Launched ${-days} days ago` : days === 0 ? "Launches today" : `${days} days to launch`}
              </span>
            )}
            <label className="flex items-center gap-1.5">
              Sizes
              <input className="input h-7 w-36 py-0.5 text-[13px]" defaultValue={c.sizes} placeholder="XS, S, M, L, XL" onBlur={(e) => e.target.value !== c.sizes && patch({ sizes: e.target.value })} />
            </label>
            <label className="flex items-center gap-1.5">
              Pieces planned
              <input
                className="input h-7 w-14 py-0.5 text-[13px]"
                inputMode="numeric"
                defaultValue={c.targetPieces ?? ""}
                placeholder="—"
                onBlur={(e) => {
                  const v = e.target.value.trim() ? Number(e.target.value) : null;
                  if (v !== c.targetPieces && (v === null || Number.isFinite(v))) patch({ targetPieces: v });
                }}
              />
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input h-9 w-auto" value={c.status} aria-label="Collection status" onChange={(e) => patch({ status: e.target.value as CollectionStatus })}>
            {STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <Link href={`/collections/${c.id}/linesheet`} target="_blank" className="btn btn-primary h-9">
            <FileText size={15} /> Line sheet
          </Link>
        </div>
      </div>

      <StoryField value={c.story} onSave={(story) => patch({ story })} />

      {/* ---------- stats ---------- */}
      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line shadow-elev-sm sm:grid-cols-5">
        {[
          ["Pieces", c.targetPieces ? `${stats.planned} of ${c.targetPieces}` : String(stats.planned), `${stats.started} started`],
          ["Tech packs", `${stats.packs}`, stats.planned ? `${Math.round((stats.packs / stats.planned) * 100)}% of the line` : "—"],
          ["Sampling", `${stats.sampling}`, "with vendors"],
          ["Approved", `${stats.approved}`, stats.planned ? `of ${stats.planned}` : "—"],
          ["Average margin", avgMargin != null ? `${avgMargin}%` : "—", margins.length ? `on ${margins.length} priced` : "set prices to see it"],
        ].map(([k, v, sub]) => (
          <div key={k} className="bg-card px-4 py-3">
            <dt className="text-[12px] text-ink-2">{k}</dt>
            <dd className="num mt-0.5 text-[22px] font-medium leading-tight text-ink">{v}</dd>
            <dd className="text-[12px] text-muted">{sub}</dd>
          </div>
        ))}
      </dl>

      {/* ---------- tabs ---------- */}
      <div className="sticky top-0 z-20 -mx-5 mt-8 bg-bg/90 px-5 backdrop-blur-md">
        <div className="tabs" role="tablist">
          {(
            [
              ["plan", "Line plan"],
              ["colour", "Colour, fabric & mood"],
              ["costing", "Costing"],
              ["checks", `Checks${checks.length ? ` (${checks.length})` : ""}`],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className="tab" onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div aria-live="polite" className="min-h-6">
        {busy && <p className="mt-3 text-[13px] text-ink-2">{busy}…</p>}
        {error && <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-[13px] text-warn-ink">{error}</p>}
        {note && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-accent-soft px-3 py-2 text-[13px] text-ink">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-accent" />
            <span className="flex-1">{note}</span>
            <button aria-label="Dismiss" onClick={() => setNote(null)}>
              <X size={14} />
            </button>
          </p>
        )}
      </div>

      {tab === "plan" && (
        <PlanTab
          c={c}
          rows={rows}
          busy={!!busy}
          currency={currency}
          onPatchPlan={(plan) => patch({ plan })}
          onPieces={pieces}
          onStart={start}
          onSuggest={async (count) => {
            const out = await call(`/api/collections/${c.id}/suggest`, "POST", { count }, "Planning pieces with the assistant");
            if (out) {
              setData({ collection: out.collection, pieces: out.pieces });
              setNote(out.rationale);
            }
          }}
        />
      )}
      {tab === "colour" && (
        <ColourTab c={c} rows={rows} currency={currency} onPatch={patch} onCollection={(col) => setData((d) => ({ ...d, collection: col }))} />
      )}
      {tab === "costing" && <CostingTab c={c} rows={rows} currency={currency} onPatchPlan={(plan) => patch({ plan })} />}
      {tab === "checks" && <ChecksTab checks={checks} />}

      {/* ---------- hand off ---------- */}
      <HandoffPanel c={c} units={units} packs={stats.packs} onCollection={(col) => setData((d) => ({ ...d, collection: col }))} call={call} />
    </div>
  );
}

/* ---------- story ---------- */

function StoryField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const grow = () => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  };
  useEffect(grow, []);
  return (
    <textarea
      ref={ref}
      rows={2}
      className="mt-4 w-full max-w-3xl resize-none rounded-lg bg-transparent px-1 py-1 text-[15px] leading-relaxed text-ink outline-none placeholder:text-muted hover:bg-panel focus:bg-card"
      placeholder="What is this drop about? The mood, the moment she wears it, references. The assistant uses this for every piece."
      defaultValue={value}
      onInput={grow}
      onBlur={(e) => e.target.value !== value && onSave(e.target.value)}
      aria-label="Collection story"
    />
  );
}

/* ---------- line plan ---------- */

function PlanTab({
  c,
  rows,
  busy,
  currency,
  onPatchPlan,
  onPieces,
  onStart,
  onSuggest,
}: {
  c: Collection;
  rows: LineRow[];
  busy: boolean;
  currency: string;
  onPatchPlan: (plan: PlanItem[]) => void;
  onPieces: (body: object, label: string) => Promise<unknown>;
  onStart: (p: PlanItem) => void;
  onSuggest: (count: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [products, setProducts] = useState<{ id: string; name: string; collectionId: string | null }[] | null>(null);
  const [count, setCount] = useState(4);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    if (!adding || products) return;
    fetch("/api/products")
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => setProducts([]));
  }, [adding, products]);

  const available = (products ?? []).filter((p) => p.collectionId !== c.id);

  function move(id: string, dir: -1 | 1) {
    const i = c.plan.findIndex((p) => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= c.plan.length) return;
    const next = [...c.plan];
    [next[i], next[j]] = [next[j], next[i]];
    onPatchPlan(next);
  }

  return (
    <div className="mt-4">
      {rows.length === 0 && (
        <div className="drafting-grid rounded-xl px-6 py-10 text-center shadow-elev-sm">
          <p className="h-title text-lg">An empty line plan</p>
          <p className="mx-auto mt-1 max-w-md text-[13.5px] text-ink-2">
            Plan pieces as ideas first, bring in products you already made, or ask the assistant for a balanced line.
          </p>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r, i) => {
          const p = r.piece;
          const plan = r.plan;
          const m = margin(r.cost, r.retail);
          const isIdea = !p;
          return (
            <li
              key={plan?.id ?? p?.id}
              className={`group relative flex flex-col rounded-xl border bg-card transition-shadow ${
                isIdea ? "border-dashed border-line-strong" : "border-line shadow-elev-sm hover:shadow-elev-md"
              }`}
            >
              <div className="flex items-start gap-3 p-3">
                <div className={`flex h-[104px] w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-lg ${isIdea ? "drafting-grid" : "bg-artifact"}`}>
                  {p?.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fileUrl(p.id, p.thumb)} alt="" className="h-full w-full object-contain p-1" />
                  ) : (
                    <span className="px-1 text-center text-[11px] text-muted">{isIdea ? r.category || "Idea" : "No image yet"}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <span className="code mt-0.5 text-[11.5px] text-muted">{p?.styleNumber || String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1" />
                    {plan && (
                      <span className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button className="btn btn-ghost h-6 w-6 p-0 text-[12px]" aria-label="Move earlier" onClick={() => move(plan.id, -1)}>
                          ‹
                        </button>
                        <button className="btn btn-ghost h-6 w-6 p-0 text-[12px]" aria-label="Move later" onClick={() => move(plan.id, 1)}>
                          ›
                        </button>
                        <button
                          className="btn btn-ghost h-6 w-6 p-0 text-muted hover:text-danger"
                          aria-label={`Remove ${r.name} from the collection`}
                          onClick={() =>
                            confirm(p ? `Take “${r.name}” out of the collection? The product itself stays.` : `Remove the idea “${r.name}”?`) &&
                            onPieces({ action: "remove", planId: plan.id }, "Removing")
                          }
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    )}
                    {!plan && p && (
                      <button
                        className="btn btn-ghost h-6 w-6 p-0 text-muted opacity-0 group-hover:opacity-100 hover:text-danger"
                        aria-label="Take out of collection"
                        onClick={() => onPieces({ action: "detach", productId: p.id }, "Removing")}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  {isIdea && plan && editing === plan.id ? (
                    <IdeaEditor
                      plan={plan}
                      onSave={(changed) => {
                        onPatchPlan(c.plan.map((x) => (x.id === plan.id ? { ...x, ...changed } : x)));
                        setEditing(null);
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <>
                      {p ? (
                        <Link href={`/products/${p.id}`} className="block text-[14.5px] font-medium leading-snug text-ink hover:underline">
                          {r.name}
                        </Link>
                      ) : (
                        <button className="block text-left text-[14.5px] font-medium leading-snug text-ink hover:underline" onClick={() => plan && setEditing(plan.id)}>
                          {r.name}
                        </button>
                      )}
                      <div className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-2">
                        {[r.category, p?.fabric].filter(Boolean).join(" · ") || (isIdea ? "Click the name to add details" : "")}
                      </div>
                      {isIdea && plan?.notes && <p className="mt-1 line-clamp-3 text-[12.5px] text-ink-2">{plan.notes}</p>}
                    </>
                  )}
                  {r.colorways.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.colorways.map((cw) => (
                        <span
                          key={cw.name}
                          title={cw.name}
                          className={`h-4 w-4 rounded-full border ${paletteIndex(c.palette, cw) < 0 && c.palette.length ? "border-warn ring-1 ring-warn" : "border-line"}`}
                          style={{ background: cw.hex }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-auto border-t border-line px-3 py-2.5">
                {p ? (
                  <>
                    <div className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="status-chip capitalize" data-status={p.status}>
                        {p.lastSample ? `${SAMPLE_STAGES[p.lastSample.stage]}${p.lastSample.verdict ? `: ${p.lastSample.verdict}` : ""}` : p.hasTechPack ? p.status : "Not started"}
                      </span>
                      <span className="num text-ink-2">
                        {r.retail != null ? money(r.retail, currency) : "No price"}
                        {m != null && <span className={m < 50 ? "text-warn-ink" : "text-muted"}> · {m}%</span>}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-1" role="img" aria-label={`${p.outputsDone} of ${p.outputsTotal} outputs ready`}>
                      {Array.from({ length: p.outputsTotal }).map((_, k) => (
                        <span key={k} className={`h-1 flex-1 rounded-full ${k < p.outputsDone ? "bg-accent" : "bg-line"}`} />
                      ))}
                    </div>
                    {p.openDecisions > 0 && <p className="mt-1.5 text-[12px] text-warn-ink">{p.openDecisions} open decisions</p>}
                  </>
                ) : (
                  plan && (
                    <button className="btn w-full justify-center" disabled={busy} onClick={() => onStart(plan)}>
                      Start tech pack <ArrowRight size={14} />
                    </button>
                  )
                )}
              </div>
            </li>
          );
        })}

        {/* add tile */}
        <li className="rounded-xl border border-dashed border-line-strong bg-panel/50 p-4">
          {adding ? (
            <div className="space-y-3">
              <form
                className="space-y-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!name.trim()) return;
                  await onPieces({ action: "plan", name, category }, "Adding");
                  setName("");
                  setCategory("");
                }}
              >
                <p className="text-[13px] font-medium text-ink">Plan a piece</p>
                <input className="input" placeholder="e.g. Smocked wide-leg pant" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                <div className="flex gap-2">
                  <input className="input" list="plan-categories" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
                  <datalist id="plan-categories">
                    {CATEGORIES.map((x) => (
                      <option key={x} value={x} />
                    ))}
                  </datalist>
                  <button className="btn btn-primary" disabled={busy || !name.trim()}>
                    Add
                  </button>
                </div>
              </form>
              <div className="border-t border-line pt-3">
                <p className="mb-1.5 text-[13px] font-medium text-ink">Or bring in a product</p>
                <select
                  className="input"
                  value=""
                  onChange={(e) => e.target.value && onPieces({ action: "add", productId: e.target.value }, "Adding the product")}
                >
                  <option value="">{products === null ? "Loading…" : available.length ? "Choose a product" : "No other products"}</option>
                  {available.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.collectionId ? " (in another collection)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-ghost w-full" onClick={() => setAdding(false)}>
                Done
              </button>
            </div>
          ) : (
            <div className="flex h-full flex-col justify-center gap-2">
              <button className="btn w-full justify-center" onClick={() => setAdding(true)}>
                <Plus size={15} /> Add a piece
              </button>
              <div className="flex items-center gap-2">
                <button className="btn flex-1 justify-center" disabled={busy} onClick={() => onSuggest(count)}>
                  <Sparkles size={14} /> Suggest {count} <Cost usd={COST.plan} />
                </button>
                <select className="input h-9 w-16 py-0.5" aria-label="How many to suggest" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                  {[2, 3, 4, 5, 6, 8].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </div>
              <p className="text-center text-[12px] text-muted">Suggestions use the story, palette and fabric library.</p>
            </div>
          )}
        </li>
      </ul>
    </div>
  );
}

function IdeaEditor({ plan, onSave, onCancel }: { plan: PlanItem; onSave: (p: Partial<PlanItem>) => void; onCancel: () => void }) {
  const [name, setName] = useState(plan.name);
  const [category, setCategory] = useState(plan.category);
  const [notes, setNotes] = useState(plan.notes);
  return (
    <div className="mt-1 space-y-1.5">
      <input className="input h-8 py-1 text-[13.5px]" value={name} onChange={(e) => setName(e.target.value)} aria-label="Piece name" autoFocus />
      <input className="input h-8 py-1 text-[13px]" list="plan-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" aria-label="Category" />
      <textarea className="input min-h-16 py-1 text-[13px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Silhouette, details, fabric" aria-label="Notes" />
      <div className="flex gap-2">
        <button className="btn btn-primary h-7 px-2.5 text-[12.5px]" onClick={() => onSave({ name: name.trim() || plan.name, category, notes })}>
          Save
        </button>
        <button className="btn btn-ghost h-7 px-2.5 text-[12.5px]" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ---------- colour, fabric and mood ---------- */

function ColourTab({
  c,
  rows,
  currency,
  onPatch,
  onCollection,
}: {
  c: Collection;
  rows: LineRow[];
  currency: string;
  onPatch: (change: Partial<Collection>) => void;
  onCollection: (c: Collection) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function addMood(files: FileList) {
    setUploading(true);
    const images = await Promise.all([...files].filter((f) => f.type.startsWith("image/")).slice(0, 12).map((f) => resizePhoto(f, 1400)));
    const res = await fetch(`/api/collections/${c.id}/mood`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images }) });
    if (res.ok) onCollection(await res.json());
    setUploading(false);
  }

  function togglePlanColour(plan: PlanItem, colour: string) {
    const has = plan.colorways.includes(colour);
    onPatch({ plan: c.plan.map((p) => (p.id === plan.id ? { ...p, colorways: has ? p.colorways.filter((x) => x !== colour) : [...p.colorways, colour] } : p)) });
  }

  async function useBrandPalette() {
    const brand = await fetch("/api/brand").then((r) => r.json());
    const add = (brand.palette ?? []).filter((p: { name: string }) => p.name && !c.palette.some((x) => x.name === p.name));
    if (add.length) onPatch({ palette: [...c.palette, ...add] });
  }

  return (
    <div className="mt-4 space-y-10">
      {/* palette */}
      <section aria-labelledby="palette-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 id="palette-title" className="h-title text-[18px]">
              Palette
            </h3>
            <p className="text-[13px] text-ink-2">The colours this drop is made in. New pieces use them, and checks flag colours outside it.</p>
          </div>
          <button className="btn h-8 text-[12.5px]" onClick={useBrandPalette}>
            Add Brand DNA colours
          </button>
        </div>
        <ul className="mt-3 flex flex-wrap gap-3">
          {c.palette.map((p, i) => (
            <li key={i} className="group w-36 rounded-xl border border-line bg-card p-2 shadow-elev-sm">
              <label className="block h-16 cursor-pointer overflow-hidden rounded-lg" style={{ background: p.hex }}>
                <input
                  type="color"
                  className="h-0 w-0 opacity-0"
                  value={/^#[0-9a-f]{6}$/i.test(p.hex) ? p.hex : "#d9d4c7"}
                  onChange={(e) => onPatch({ palette: c.palette.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)) })}
                  aria-label={`${p.name || "Colour"} hex`}
                />
              </label>
              <input
                className="mt-1.5 w-full bg-transparent text-[13px] font-medium text-ink outline-none"
                defaultValue={p.name}
                placeholder="Name"
                onBlur={(e) => e.target.value !== p.name && onPatch({ palette: c.palette.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
              />
              <div className="flex items-center gap-1">
                <input
                  className="code w-full bg-transparent text-[11.5px] text-muted outline-none"
                  defaultValue={p.pantone}
                  placeholder="Pantone TCX"
                  onBlur={(e) => e.target.value !== p.pantone && onPatch({ palette: c.palette.map((x, j) => (j === i ? { ...x, pantone: e.target.value } : x)) })}
                />
                <button className="text-muted opacity-0 group-hover:opacity-100 hover:text-danger" aria-label="Remove colour" onClick={() => onPatch({ palette: c.palette.filter((_, j) => j !== i) })}>
                  <X size={13} />
                </button>
              </div>
            </li>
          ))}
          <li>
            <button
              className="flex h-[118px] w-36 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong text-[12.5px] text-ink-2 hover:border-accent hover:text-accent"
              onClick={() => onPatch({ palette: [...c.palette, { name: "", pantone: "", hex: "#d9d4c7" }] })}
            >
              <Plus size={16} /> Add colour
            </button>
          </li>
        </ul>
      </section>

      {/* colour matrix */}
      {rows.length > 0 && c.palette.length > 0 && (
        <section aria-labelledby="matrix-title">
          <h3 id="matrix-title" className="h-title text-[18px]">
            Colour matrix
          </h3>
          <p className="text-[13px] text-ink-2">Which piece comes in which colour. Click a cell to plan colours for pieces that aren&apos;t started yet.</p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-card">
            <table className="tp-table">
              <thead>
                <tr>
                  <th>Piece</th>
                  {c.palette.map((p, i) => (
                    <th key={i} className="text-center">
                      <span className="mx-auto block h-4 w-4 rounded-full border border-line" style={{ background: p.hex }} />
                      <span className="mt-1 block text-[11.5px] font-normal">{p.name || p.hex}</span>
                    </th>
                  ))}
                  <th>Outside palette</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => {
                  const idx = r.colorways.map((cw) => paletteIndex(c.palette, cw));
                  const editable = !r.piece?.hasTechPack && r.plan;
                  return (
                    <tr key={ri}>
                      <td className="font-medium text-ink">{r.name}</td>
                      {c.palette.map((p, i) => {
                        const on = idx.includes(i);
                        return (
                          <td key={i} className="text-center">
                            {editable ? (
                              <button
                                className={`mx-auto grid h-6 w-6 place-items-center rounded-full border transition-colors ${on ? "border-transparent" : "border-dashed border-line-strong hover:border-accent"}`}
                                style={on ? { background: p.hex } : undefined}
                                aria-pressed={on}
                                aria-label={`${r.name} in ${p.name}`}
                                onClick={() => togglePlanColour(r.plan!, p.name)}
                              >
                                {on && <Check size={12} className="text-white mix-blend-difference" />}
                              </button>
                            ) : on ? (
                              <span className="mx-auto block h-5 w-5 rounded-full border border-line" style={{ background: p.hex }} title={`${r.name} in ${p.name}`} />
                            ) : (
                              <span className="text-line-strong">·</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-[12.5px] text-warn-ink">{r.colorways.filter((_, k) => idx[k] < 0).map((x) => x.name).join(", ")}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="text-[12.5px] text-ink-2">Pieces per colour</td>
                  {c.palette.map((_, i) => (
                    <td key={i} className="num text-center text-[12.5px] text-ink-2">
                      {rows.filter((r) => r.colorways.some((cw) => paletteIndex(c.palette, cw) === i)).length}
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* fabric library */}
      <FabricLibrary c={c} currency={currency} onSave={(fabrics) => onPatch({ fabrics })} />

      {/* moodboard */}
      <section aria-labelledby="mood-title">
        <h3 id="mood-title" className="h-title text-[18px]">
          Mood
        </h3>
        <p className="text-[13px] text-ink-2">References for the whole drop. The first image leads the line sheet cover.</p>
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {c.moodboard.map((f) => (
            <li key={f} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/collections/${c.id}/files/${f}`} alt="" className="aspect-square w-full rounded-lg object-cover shadow-elev-sm" />
              <button
                className="btn absolute right-1 top-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                aria-label="Remove image"
                onClick={async () => {
                  const res = await fetch(`/api/collections/${c.id}/mood?file=${encodeURIComponent(f)}`, { method: "DELETE" });
                  if (res.ok) onCollection(await res.json());
                }}
              >
                <X size={12} />
              </button>
            </li>
          ))}
          <li>
            <button
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong text-[12px] text-ink-2 hover:border-accent hover:text-accent"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
            >
              <ImagePlus size={18} /> {uploading ? "Uploading…" : "Add images"}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addMood(e.target.files);
                e.target.value = "";
              }}
            />
          </li>
        </ul>
      </section>
    </div>
  );
}

function FabricLibrary({ c, currency, onSave }: { c: Collection; currency: string; onSave: (f: CollectionFabric[]) => void }) {
  const set = (id: string, change: Partial<CollectionFabric>) => onSave(c.fabrics.map((f) => (f.id === id ? { ...f, ...change } : f)));
  const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[^\d.]/g, "")) || null);
  return (
    <section aria-labelledby="fabric-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 id="fabric-title" className="h-title text-[18px]">
            Fabric library
          </h3>
          <p className="text-[13px] text-ink-2">
            Fabrics the pieces share. Sharing fabric across styles makes vendor minimums easier to reach.
          </p>
        </div>
        <button
          className="btn h-8 text-[12.5px]"
          onClick={() =>
            onSave([...c.fabrics, { id: crypto.randomUUID(), name: "", composition: "", construction: "", weightGsm: null, supplier: "", pricePerM: null, notes: "" }])
          }
        >
          <Plus size={13} /> Add fabric
        </button>
      </div>
      {c.fabrics.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-card">
          <table className="tp-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Composition</th>
                <th>Construction</th>
                <th className="text-right">GSM</th>
                <th>Supplier / mill</th>
                <th className="text-right">Price / m ({currencyOf(currency).symbol.trim()})</th>
                <th>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {c.fabrics.map((f) => (
                <tr key={f.id}>
                  {(
                    [
                      ["name", "Rayon crinkle", "min-w-32"],
                      ["composition", "100% rayon", "min-w-32"],
                      ["construction", "Crinkle woven", "min-w-28"],
                    ] as const
                  ).map(([k, ph, w]) => (
                    <td key={k}>
                      <input className={`tp-num ${w} text-left`} defaultValue={f[k]} placeholder={ph} onBlur={(e) => e.target.value !== f[k] && set(f.id, { [k]: e.target.value })} />
                    </td>
                  ))}
                  <td className="text-right">
                    <input className="tp-num" inputMode="numeric" defaultValue={f.weightGsm ?? ""} placeholder="—" onBlur={(e) => set(f.id, { weightGsm: numOrNull(e.target.value) })} />
                  </td>
                  <td>
                    <input className="tp-num min-w-32 text-left" defaultValue={f.supplier} placeholder="e.g. Surat mill" onBlur={(e) => e.target.value !== f.supplier && set(f.id, { supplier: e.target.value })} />
                  </td>
                  <td className="text-right">
                    <input className="tp-num" inputMode="decimal" defaultValue={f.pricePerM ?? ""} placeholder="—" onBlur={(e) => set(f.id, { pricePerM: numOrNull(e.target.value) })} />
                  </td>
                  <td>
                    <input className="tp-num min-w-40 text-left" defaultValue={f.notes} placeholder="MOQ, lead time, lab dip" onBlur={(e) => e.target.value !== f.notes && set(f.id, { notes: e.target.value })} />
                  </td>
                  <td>
                    <button className="btn btn-ghost h-7 w-7 p-0 text-muted hover:text-danger" aria-label="Remove fabric" onClick={() => onSave(c.fabrics.filter((x) => x.id !== f.id))}>
                      <X size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------- costing ---------- */

function CostingTab({ c, rows, currency, onPatchPlan }: { c: Collection; rows: LineRow[]; currency: string; onPatchPlan: (p: PlanItem[]) => void }) {
  const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[^\d.]/g, "")));
  const setPlan = (id: string, change: Partial<PlanItem>) => onPatchPlan(c.plan.map((p) => (p.id === id ? { ...p, ...change } : p)));
  const priced = rows.filter((r) => r.cost != null && r.retail != null);
  const buy = rows.reduce((sum, r) => sum + (r.cost ?? 0) * (r.piece?.moq ?? 0) * Math.max(1, r.colorways.length), 0);
  return (
    <div className="mt-4">
      <p className="text-[13px] text-ink-2">
        Prices in {currencyOf(currency).label}. Pieces with a tech pack take their numbers from it (change them there); ideas
        take the targets you type here.
      </p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-card">
        <table className="tp-table">
          <thead>
            <tr>
              <th>Piece</th>
              <th className="text-right">Factory cost</th>
              <th className="text-right">Retail</th>
              <th className="text-right">Margin</th>
              <th className="text-right">MOQ / colour</th>
              <th className="text-right">Colours</th>
              <th className="text-right">First buy</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const m = margin(r.cost, r.retail);
              const editable = r.plan && !r.piece?.hasTechPack;
              const first = r.cost != null && r.piece?.moq ? r.cost * r.piece.moq * Math.max(1, r.colorways.length) : null;
              return (
                <tr key={i}>
                  <td className="font-medium text-ink">
                    {r.piece ? (
                      <Link href={`/products/${r.piece.id}?step=specs`} className="hover:underline">
                        {r.name}
                      </Link>
                    ) : (
                      r.name
                    )}
                  </td>
                  <td className="text-right">
                    {editable ? (
                      <input className="tp-num" inputMode="decimal" defaultValue={r.cost ?? ""} placeholder="—" onBlur={(e) => setPlan(r.plan!.id, { targetCost: numOrNull(e.target.value) })} />
                    ) : (
                      <span className="num">{money(r.cost, currency)}</span>
                    )}
                  </td>
                  <td className="text-right">
                    {editable ? (
                      <input className="tp-num" inputMode="decimal" defaultValue={r.retail ?? ""} placeholder="—" onBlur={(e) => setPlan(r.plan!.id, { targetRetail: numOrNull(e.target.value) })} />
                    ) : (
                      <span className="num">{money(r.retail, currency)}</span>
                    )}
                  </td>
                  <td className={`num text-right ${m != null && m < 50 ? "text-warn-ink" : ""}`}>{m != null ? `${m}%` : "—"}</td>
                  <td className="num text-right">{r.piece?.moq ?? "—"}</td>
                  <td className="num text-right">{r.colorways.length || "—"}</td>
                  <td className="num text-right">{first != null ? money(first, currency) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="font-medium">Collection</td>
              <td />
              <td />
              <td className="num text-right font-medium">
                {priced.length ? `${Math.round(priced.reduce((s, r) => s + (margin(r.cost, r.retail) ?? 0), 0) / priced.length)}%` : "—"}
              </td>
              <td />
              <td />
              <td className="num text-right font-medium">{buy ? money(buy, currency) : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2 text-[12.5px] text-muted">First buy = factory cost × MOQ per colour × colours. Margin is before tax and shipping.</p>
    </div>
  );
}

/* ---------- checks ---------- */

function ChecksTab({ checks }: { checks: ReturnType<typeof collectionChecks> }) {
  if (!checks.length)
    return (
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-card px-5 py-4 shadow-elev-sm">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-ok-soft text-ok">
          <Check size={15} />
        </span>
        <span className="text-[14px] text-ink">Everything lines up: palette, sizes, fabrics, style numbers and decisions.</span>
      </div>
    );
  return (
    <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-card shadow-elev-sm">
      {checks.map((ch, i) => (
        <li key={i} className="flex items-start gap-3 px-4 py-3 text-[13.5px]">
          {ch.level === "warn" ? <CircleAlert size={16} className="mt-0.5 shrink-0 text-warn" /> : <Info size={16} className="mt-0.5 shrink-0 text-muted" />}
          <span className="flex-1 text-ink">{ch.text}</span>
          {ch.pieceId && (
            <Link href={`/products/${ch.pieceId}?step=specs`} className="btn h-7 px-2.5 text-[12.5px]">
              Open
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ---------- hand off ---------- */

function HandoffPanel({
  c,
  units,
  packs,
  onCollection,
  call,
}: {
  c: Collection;
  units: string;
  packs: number;
  onCollection: (c: Collection) => void;
  call: (url: string, method: string, body?: object, label?: string) => Promise<Collection | null>;
}) {
  const [copied, setCopied] = useState(false);
  const url = c.share?.token ? `${typeof window !== "undefined" ? window.location.origin : ""}/f/c/${c.share.token}` : null;
  const card = "card flex items-start gap-3 p-4 transition-shadow hover:shadow-elev-lg";
  return (
    <section className="mt-12 border-t border-line pt-7" aria-labelledby="drop-handoff">
      <h2 id="drop-handoff" className="h-title text-[22px]">
        Hand off the drop
      </h2>
      <p className="mt-1 text-[13.5px] text-ink-2">
        Everything for the {packs} {packs === 1 ? "piece" : "pieces"} with a tech pack, in {units === "in" ? "inches" : "cm"}.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={`/collections/${c.id}/linesheet`} target="_blank" className={card}>
          <FileText size={20} className="mt-0.5 text-accent" />
          <span>
            <span className="block font-medium text-ink">Line sheet</span>
            <span className="mt-0.5 block text-[13px] text-ink-2">Cover, palette and every style on one landscape sheet.</span>
          </span>
        </Link>
        <Link href={`/collections/${c.id}/print?units=${units}`} target="_blank" className={card}>
          <FileText size={20} className="mt-0.5 text-accent" />
          <span>
            <span className="block font-medium text-ink">Collection PDF</span>
            <span className="mt-0.5 block text-[13px] text-ink-2">Line sheet, then every tech pack, in one document.</span>
          </span>
        </Link>
        <a href={`/api/collections/${c.id}/excel?units=${units}`} className={card}>
          <FileSpreadsheet size={20} className="mt-0.5 text-accent" />
          <span>
            <span className="block font-medium text-ink">Line list (Excel)</span>
            <span className="mt-0.5 block text-[13px] text-ink-2">Line list, colour matrix, size charts, BOMs, fabrics.</span>
          </span>
        </a>
        <a href={`/api/collections/${c.id}/export?units=${units}`} className={card}>
          <FileArchive size={20} className="mt-0.5 text-accent" />
          <span>
            <span className="block font-medium text-ink">Collection ZIP</span>
            <span className="mt-0.5 block text-[13px] text-ink-2">Every piece&apos;s factory pack plus the line list.</span>
          </span>
        </a>
      </div>

      <div className="mt-5 rounded-xl bg-card p-4 shadow-elev-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Link2 size={20} className="mt-0.5 text-accent" />
            <div>
              <div className="font-medium text-ink">Vendor link for the collection</div>
              <p className="mt-0.5 max-w-lg text-[13px] text-ink-2">
                One private link with the line sheet (no prices). Each style opens its full tech pack, Excel and files.
                No login needed. Turning it off also turns off the style links it made.
              </p>
            </div>
          </div>
          {url ? (
            <button
              className="btn text-danger"
              onClick={async () => {
                if (!confirm("Turn off the collection link? Vendors will lose access.")) return;
                const out = await call(`/api/collections/${c.id}/share`, "DELETE", undefined, "Turning the link off");
                if (out) onCollection(out);
              }}
            >
              Turn off
            </button>
          ) : (
            <button
              className="btn btn-primary"
              disabled={!packs}
              onClick={async () => {
                const out = await call(`/api/collections/${c.id}/share`, "POST", undefined, "Creating the link");
                if (out) onCollection(out);
              }}
            >
              Create link
            </button>
          )}
        </div>
        {url && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input className="input code flex-1 text-[12.5px]" readOnly value={url} aria-label="Collection link" onFocus={(e) => e.target.select()} />
            <button
              className="btn"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <Copy size={14} /> {copied ? "Copied" : "Copy"}
            </button>
            <a className="btn" href={url} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Open
            </a>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-end">
        <DeleteCollection id={c.id} name={c.name} />
      </div>
    </section>
  );
}

function DeleteCollection({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <button
      className="text-[12.5px] text-muted hover:text-danger"
      onClick={async () => {
        if (!confirm(`Delete the collection “${name}”? Its products stay; they just leave the collection.`)) return;
        await fetch(`/api/collections/${id}`, { method: "DELETE" });
        router.push("/collections");
        router.refresh();
      }}
    >
      Delete collection
    </button>
  );
}
