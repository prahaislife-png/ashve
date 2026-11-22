"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  CircleDashed,
  Clock3,
  Factory,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { DecisionCard, DecisionMode, Job, Product, productViews } from "@/lib/schema";
import { watchJob } from "@/lib/jobsClient";
import { COST, Cost } from "./Section";

type Draft = { choice: number | null; text: string; mode: DecisionMode | "later" };
type Result = { reply: string; changed: { key: string; label: string }[]; jobs: Job[] };

const emptyDraft: Draft = { choice: null, text: "", mode: "answer" };
const storageKey = (id: string) => `decisions:${id}`;

function isReady(d: Draft | undefined) {
  if (!d) return false;
  if (d.mode === "factory") return true;
  return d.mode === "answer" && (d.choice != null || d.text.trim().length > 0);
}

function answerText(d: Draft, card: DecisionCard | undefined) {
  const opt = d.choice != null ? card?.options[d.choice] : undefined;
  const picked = opt ? `${opt.label}${opt.detail ? ` (${opt.detail})` : ""}` : "";
  const note = d.text.trim();
  if (picked && note) return `${picked}. Note: ${note}`;
  return picked || note;
}

function useElapsed(active: boolean) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!active) return setS(0);
    const t0 = Date.now();
    const id = setInterval(() => setS(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [active]);
  return s;
}

/**
 * The open decisions in the tech pack, answered right here: each one gets
 * one-click answer options, and applying them updates the specs, and if she
 * wants, the product photos and flats.
 */
export default function DecisionsPanel({
  product,
  onUpdate,
  onShow,
}: {
  product: Product;
  onUpdate: (p: Product) => void;
  onShow: (key: string) => void;
}) {
  const tp = product.techPack!;
  const questions = tp.openQuestions;
  const cards = product.decisionCards ?? {};
  const log = product.decisionLog ?? [];

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [liveJobs, setLiveJobs] = useState<Record<string, Job>>({});
  const [preparing, setPreparing] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const tried = useRef(new Set<string>());
  const elapsed = useElapsed(applying);

  const hasViews = !!productViews(product)["product-front"];
  const hasFlats = (product.flats?.length ?? 0) > 0;
  const canRefresh = hasViews || hasFlats;

  /* drafts survive a reload (this browser only) */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(product.id));
      if (raw) setDrafts(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, [product.id]);

  function saveDrafts(next: Record<string, Draft>) {
    setDrafts(next);
    try {
      localStorage.setItem(storageKey(product.id), JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  /* open the first decision that still needs an answer */
  useEffect(() => {
    if (open && questions.includes(open)) return;
    setOpen(questions.find((q) => !isReady(drafts[q]) && drafts[q]?.mode !== "later") ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.join("\n")]);

  /* ask Claude for answer options for any decision that doesn't have them yet */
  const missingKey = questions.filter((q) => !cards[q]).join("\n");
  async function prepare() {
    setPreparing(true);
    setPrepError(null);
    try {
      const res = await fetch(`/api/products/${product.id}/decisions/prepare`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't write the answer options.");
      onUpdate(data as Product);
    } catch (e) {
      setPrepError((e as Error).message);
    } finally {
      setPreparing(false);
    }
  }
  useEffect(() => {
    if (!missingKey || tried.current.has(missingKey)) return;
    tried.current.add(missingKey);
    prepare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingKey]);

  const readyList = questions.filter((q) => isReady(drafts[q]));
  const laterCount = questions.filter((q) => drafts[q]?.mode === "later").length;

  function update(q: string, patch: Partial<Draft>, advance = false) {
    const next = { ...drafts, [q]: { ...emptyDraft, ...drafts[q], ...patch } };
    saveDrafts(next);
    if (advance) {
      const after = questions.slice(questions.indexOf(q) + 1).concat(questions.slice(0, questions.indexOf(q)));
      const nextOpen = after.find((x) => !isReady(next[x]) && next[x]?.mode !== "later");
      window.setTimeout(() => setOpen(nextOpen ?? null), 220);
    }
  }

  async function apply() {
    setApplying(true);
    setError(null);
    setResult(null);
    const answers = readyList.map((q) => ({
      question: q,
      mode: drafts[q].mode as DecisionMode,
      answer: answerText(drafts[q], cards[q]),
    }));
    try {
      const res = await fetch(`/api/products/${product.id}/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, refresh: canRefresh && refresh }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't apply the answers. Please try again.");
      onUpdate(data.product as Product);
      const rest = { ...drafts };
      for (const a of answers) delete rest[a.question];
      saveDrafts(rest);
      const r: Result = { reply: data.reply, changed: data.changed ?? [], jobs: data.jobs ?? [] };
      setResult(r);
      setLiveJobs(Object.fromEntries(r.jobs.map((j) => [j.id, j])));
      for (const j of r.jobs) {
        watchJob(j, {
          onProgress: (u) => setLiveJobs((m) => ({ ...m, [u.id]: u })),
          onProduct: onUpdate,
        }).then(({ job }) => setLiveJobs((m) => ({ ...m, [job.id]: job })));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  }

  const estimate =
    COST.techPack + (canRefresh && refresh ? (hasViews ? COST.views : 0) + (hasFlats ? COST.flats : 0) : 0);

  const segments = useMemo(
    () =>
      questions.map((q) =>
        isReady(drafts[q]) ? "ready" : drafts[q]?.mode === "later" ? "later" : "open",
      ),
    [questions, drafts],
  );

  if (questions.length === 0 && log.length === 0) return null;

  return (
    <div className="mt-6 space-y-3">
      {result && (
        <ResultCard result={result} jobs={liveJobs} onShow={onShow} onClose={() => setResult(null)} />
      )}

      {questions.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card px-5 py-3.5 shadow-elev-sm">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-ok-soft text-ok">
            <Check size={15} strokeWidth={2.5} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-ink">Every decision is made</p>
            <p className="text-[12.5px] text-ink-2">Nothing is left to settle before this goes to a factory.</p>
          </div>
          <button className="btn btn-ghost h-8 text-[13px]" onClick={() => setShowLog((s) => !s)} aria-expanded={showLog}>
            {showLog ? "Hide answers" : `See ${log.length} ${log.length === 1 ? "answer" : "answers"}`}
          </button>
          {showLog && <DecisionLog log={log} />}
        </div>
      ) : (
        <div className="decisions rounded-xl border border-line bg-card shadow-elev-md">
          {/* header */}
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3 rounded-t-xl border-b border-line bg-warn-soft/60 px-5 py-4">
            <div className="min-w-0 flex-1">
              <h3 className="h-title text-[18px] text-ink">
                {questions.length} {questions.length === 1 ? "decision" : "decisions"} before this goes to a factory
              </h3>
              <p className="mt-0.5 text-[13px] text-ink-2">
                Pick an answer for each one, then apply. The specs{canRefresh ? ", photos and flats" : ""} update to match.
              </p>
            </div>
            <div className="w-full shrink-0 sm:w-56" aria-label={`${readyList.length} of ${questions.length} answered`}>
              <div className="flex gap-1" aria-hidden="true">
                {segments.map((s, i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                      s === "ready" ? "bg-ok" : s === "later" ? "bg-line-strong" : "bg-warn/70"
                    }`}
                  />
                ))}
              </div>
              <p className="num mt-1.5 text-right text-[12.5px] text-ink-2">
                {readyList.length} of {questions.length} answered
                {laterCount > 0 && <span className="text-muted">, {laterCount} later</span>}
              </p>
            </div>
          </div>

          {prepError && (
            <div className="flex items-center gap-3 border-b border-line px-5 py-2.5 text-[13px] text-warn-ink">
              <span className="flex-1">{prepError} You can still type your own answers.</span>
              <button className="btn h-7 px-2.5 text-[12.5px]" onClick={prepare} disabled={preparing}>
                <RotateCcw size={13} /> Try again
              </button>
            </div>
          )}

          <ul className="divide-y divide-line">
            {questions.map((q) => (
              <DecisionRow
                key={q}
                question={q}
                card={cards[q]}
                draft={drafts[q] ?? emptyDraft}
                open={open === q}
                preparing={preparing && !cards[q]}
                disabled={applying}
                onToggle={() => setOpen(open === q ? null : q)}
                onChange={(patch, advance) => update(q, patch, advance)}
              />
            ))}
          </ul>

          {log.length > 0 && (
            <div className="border-t border-line px-5 py-2.5">
              <button
                className="flex items-center gap-1.5 text-[12.5px] text-ink-2 hover:text-ink"
                onClick={() => setShowLog((s) => !s)}
                aria-expanded={showLog}
              >
                <ChevronDown size={14} className={`transition-transform ${showLog ? "rotate-180" : ""}`} />
                {log.length} decided earlier
              </button>
              {showLog && <DecisionLog log={log} />}
            </div>
          )}

          {/* apply bar */}
          <div className="sticky bottom-[76px] z-10 mx-3 mb-3 mt-1 lg:bottom-3 rounded-lg border border-line bg-card/95 px-4 py-3 shadow-elev-lg backdrop-blur">
            {applying ? (
              <div className="flex items-center gap-3 text-[13.5px]" role="status" aria-live="polite">
                <Loader2 size={16} className="animate-spin text-accent" />
                <span className="flex-1 text-ink">
                  Updating the tech pack with {readyList.length} {readyList.length === 1 ? "answer" : "answers"}
                  <span className="text-ink-2">: size chart, materials, construction and notes</span>
                </span>
                <span className="num text-ink-2">{elapsed}s</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
                {canRefresh ? (
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-[13px] text-ink-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--accent)]"
                      checked={refresh}
                      onChange={(e) => setRefresh(e.target.checked)}
                    />
                    <span>
                      Update {hasViews && hasFlats ? "photos and flats" : hasViews ? "photos" : "flats"} too
                      <span className="hidden sm:inline"> when the look changes</span>
                    </span>
                  </label>
                ) : (
                  <span className="min-w-0 flex-1 text-[13px] text-ink-2">
                    {readyList.length ? "Answers are applied to every section of the tech pack." : "Pick answers above to apply them."}
                  </span>
                )}
                <button className="btn btn-primary h-9" disabled={!readyList.length} onClick={apply}>
                  <Sparkles size={15} />
                  {readyList.length
                    ? `Apply ${readyList.length} ${readyList.length === 1 ? "answer" : "answers"}`
                    : "Apply answers"}
                  {readyList.length > 0 && <Cost usd={estimate} />}
                </button>
              </div>
            )}
            {error && (
              <p className="mt-2 text-[13px] text-danger" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- one decision ---------- */

function DecisionRow({
  question,
  card,
  draft,
  open,
  preparing,
  disabled,
  onToggle,
  onChange,
}: {
  question: string;
  card: DecisionCard | undefined;
  draft: Draft;
  open: boolean;
  preparing: boolean;
  disabled: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<Draft>, advance?: boolean) => void;
}) {
  const ready = isReady(draft);
  const picked = draft.choice != null ? card?.options[draft.choice] : undefined;
  const summary =
    draft.mode === "factory"
      ? "Factory to confirm"
      : draft.mode === "later"
        ? "Later"
        : picked?.label || draft.text.trim();
  const bodyId = `decision-${hash(question)}`;

  return (
    <li className={open ? "bg-panel/40" : ""}>
      <button
        type="button"
        className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-panel/60"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <StatusIcon draft={draft} ready={ready} />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium leading-snug text-ink">{card?.title ?? question}</span>
          {!open && summary && (
            <span
              className={`mt-0.5 block truncate text-[12.5px] ${ready ? "text-ok" : "text-muted"}`}
            >
              {summary}
            </span>
          )}
        </span>
        {card?.area && <span className="chip hidden shrink-0 text-[11.5px] sm:inline-flex">{card.area}</span>}
        <ChevronDown
          size={16}
          className={`mt-0.5 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        id={bodyId}
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden" inert={!open}>
          <div className="px-5 pb-4 sm:pl-[52px]">
            <p className="text-[13px] leading-relaxed text-ink-2">{card?.context || question}</p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={card?.title ?? question}>
              {card
                ? card.options.map((o, i) => {
                    const on = draft.mode === "answer" && draft.choice === i;
                    return (
                      <button
                        key={i}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={disabled}
                        onClick={() => onChange({ choice: on ? null : i, mode: "answer" }, !on)}
                        className={`group flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-[border-color,background-color,box-shadow] duration-150 active:scale-[0.99] ${
                          on
                            ? "border-accent bg-accent-soft shadow-[0_0_0_1px_var(--accent)]"
                            : "border-line bg-card hover:border-line-strong"
                        }`}
                      >
                        <span
                          className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors ${
                            on ? "border-accent bg-accent text-accent-ink" : "border-line-strong bg-card"
                          }`}
                        >
                          {on && <Check size={10} strokeWidth={3.5} />}
                        </span>
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-x-2 text-[13.5px] font-medium leading-snug text-ink">
                            {o.label}
                            {i === 0 && (
                              <span className="rounded-full bg-accent-soft px-1.5 py-px text-[11px] font-normal text-accent">
                                Suggested
                              </span>
                            )}
                          </span>
                          {o.detail && <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-2">{o.detail}</span>}
                        </span>
                      </button>
                    );
                  })
                : preparing
                  ? [0, 1, 2].map((i) => (
                      <span key={i} className="block h-[58px] animate-pulse rounded-lg border border-line bg-panel" />
                    ))
                  : null}
            </div>
            {!card && preparing && (
              <p className="mt-2 text-[12.5px] text-muted">Writing answer options from your tech pack…</p>
            )}

            <label className="mt-3 block">
              <span className="sr-only">Your own answer or a note</span>
              <input
                className="input text-[13.5px]"
                placeholder={card ? "Or write your own answer, or add a note" : "Write your answer"}
                value={draft.text}
                disabled={disabled}
                onChange={(e) => onChange({ text: e.target.value, mode: "answer" })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && draft.text.trim()) onChange({}, true);
                }}
              />
            </label>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(card?.factoryCanAnswer ?? true) && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ mode: draft.mode === "factory" ? "answer" : "factory" }, draft.mode !== "factory")}
                  aria-pressed={draft.mode === "factory"}
                  className={`chip ${draft.mode === "factory" ? "border-accent bg-accent-soft text-accent" : ""}`}
                >
                  <Factory size={13} /> Ask the factory
                </button>
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange({ mode: draft.mode === "later" ? "answer" : "later" }, draft.mode !== "later")}
                aria-pressed={draft.mode === "later"}
                className={`chip ${draft.mode === "later" ? "border-line-strong bg-panel text-ink" : ""}`}
              >
                <Clock3 size={13} /> Decide later
              </button>
              {(ready || draft.mode === "later") && (
                <button
                  type="button"
                  disabled={disabled}
                  className="ml-auto text-[12.5px] text-muted hover:text-ink"
                  onClick={() => onChange({ ...emptyDraft })}
                >
                  Clear
                </button>
              )}
            </div>
            {draft.mode === "factory" && (
              <p className="mt-2 text-[12.5px] text-ink-2">
                It goes into the tech pack as &ldquo;Factory to confirm&rdquo; so the factory answers it with the quote.
              </p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function StatusIcon({ draft, ready }: { draft: Draft; ready: boolean }) {
  if (draft.mode === "factory")
    return (
      <span className="mt-px grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-accent-soft text-accent" aria-label="Factory to confirm">
        <Factory size={12} />
      </span>
    );
  if (ready)
    return (
      <span className="mt-px grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-ok text-white" aria-label="Answered">
        <Check size={13} strokeWidth={3} />
      </span>
    );
  if (draft.mode === "later")
    return (
      <span className="mt-px grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-panel text-muted" aria-label="Later">
        <Clock3 size={12} />
      </span>
    );
  return (
    <span className="mt-px grid h-[22px] w-[22px] shrink-0 place-items-center text-warn" aria-label="Needs an answer">
      <CircleDashed size={20} />
    </span>
  );
}

/* ---------- after applying ---------- */

function ResultCard({
  result,
  jobs,
  onShow,
  onClose,
}: {
  result: Result;
  jobs: Record<string, Job>;
  onShow: (key: string) => void;
  onClose: () => void;
}) {
  const list = Object.values(jobs);
  return (
    <div className="relative rounded-xl border border-ok/30 bg-ok-soft/70 px-5 py-4 shadow-elev-sm" role="status">
      <button className="btn btn-ghost absolute right-2 top-2 h-7 w-7 p-0" aria-label="Close" onClick={onClose}>
        <X size={14} />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ok text-white">
          <Check size={15} strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-ink">Tech pack updated</p>
          {result.reply && <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{result.reply}</p>}
          {result.changed.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[12.5px] text-ink-2">Changed:</span>
              {result.changed.map((c) => (
                <button key={c.label} className="chip text-[12px]" onClick={() => onShow(c.key)}>
                  {c.label}
                </button>
              ))}
            </div>
          )}
          {list.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {list.map((j) => {
                const done = j.steps.filter((s) => s.state === "done").length;
                return (
                  <li key={j.id} className="flex items-center gap-2 text-[13px]">
                    {j.status === "running" ? (
                      <Loader2 size={14} className="animate-spin text-accent" />
                    ) : j.status === "done" ? (
                      <Check size={14} className="text-ok" />
                    ) : (
                      <X size={14} className="text-danger" />
                    )}
                    <span className="text-ink">
                      {j.kind === "views" ? "Product photos" : "Flat sketches"}
                    </span>
                    <span className="text-ink-2">
                      {j.status === "running"
                        ? `${j.steps.find((s) => s.state === "running")?.label ?? "Starting"} (${done}/${j.steps.length})`
                        : j.status === "done"
                          ? "Updated"
                          : (j.error ?? "Didn't finish")}
                    </span>
                  </li>
                );
              })}
              {list.some((j) => j.status === "running") && (
                <li className="text-[12px] text-muted">Runs in the background. You can keep working.</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function DecisionLog({ log }: { log: Product["decisionLog"] & object }) {
  return (
    <ul className="mt-2 w-full space-y-1.5 pb-1">
      {[...log].reverse().map((e) => (
        <li key={e.id} className="grid gap-x-3 text-[12.5px] sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <span className="text-ink-2">{e.title}</span>
          <span className="text-ink">
            {e.mode === "factory" && <Factory size={12} className="mr-1 inline text-accent" />}
            {e.answer}
          </span>
        </li>
      ))}
    </ul>
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
