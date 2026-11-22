"use client";

import { useEffect, useState } from "react";
import { Check, Circle, Loader2, X } from "lucide-react";
import type { Job } from "@/lib/schema";

/** A spec section: hairline rule, heading, then content on the page (no card around it). */
export function Section({
  id,
  title,
  subtitle,
  badge,
  actions,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-7" aria-labelledby={`${id}-title`}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 id={`${id}-title`} className="h-title text-[22px]">
              {title}
            </h2>
            {badge}
          </div>
          <p className="mt-1 text-[13.5px] text-ink-2">{subtitle}</p>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (t: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          className="tab"
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-line py-2.5">
      <dt className="field-label">{label}</dt>
      <dd className="mt-0.5 text-ink">{value || <span className="text-muted">Not set</span>}</dd>
    </div>
  );
}

/** Small "≈ $0.40" hint for buttons that spend API money. */
export function Cost({ usd }: { usd: number }) {
  return <span className="cost">≈ ${usd < 0.1 ? usd.toFixed(2) : usd.toFixed(2)}</span>;
}

/** Typical cost per action, measured from real runs (see the usage monitor). */
export const COST = {
  techPack: 0.15,
  views: 0.13,
  view: 0.05,
  mockup: 0.05,
  flats: 0.4,
  technical: 0.2,
  details: 0.03,
  closeup: 0.05,
  print: 0.05,
  label: 0.07,
  email: 0.02,
};

function useElapsed(active: boolean) {
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) {
      setStart(null);
      return;
    }
    const t0 = Date.now();
    setStart(t0);
    setNow(t0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return start ? Math.max(0, Math.round((now - start) / 1000)) : 0;
}

function fmt(s: number) {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

/**
 * Progress for an AI job: what is happening, how long it has been running,
 * and that it's fine to keep working. Announced politely to screen readers.
 */
export function Status({
  busy,
  error,
  job,
}: {
  busy: string | null;
  error: string | null;
  job?: Job | null;
}) {
  const elapsed = useElapsed(!!busy);
  return (
    <div aria-live="polite" role="status">
      {busy && (
        <div className="mt-4 rounded-lg bg-accent-soft px-3.5 py-2.5 text-[13.5px] text-ink">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <span className="flex-1">{job ? job.label : busy}</span>
            <span className="num shrink-0 text-ink-2">{fmt(elapsed)}</span>
          </div>
          {job && job.steps.length > 0 && (
            <ol className="mt-2 space-y-1 pl-5">
              {job.steps.map((s) => (
                <li key={s.key} className="flex items-center gap-2 text-[13px]">
                  {s.state === "done" ? (
                    <Check size={13} className="text-ok" aria-label="Done" />
                  ) : s.state === "running" ? (
                    <Loader2 size={13} className="animate-spin text-accent" aria-label="In progress" />
                  ) : s.state === "failed" ? (
                    <X size={13} className="text-danger" aria-label="Failed" />
                  ) : (
                    <Circle size={11} className="ml-px text-line-strong" aria-label="Waiting" />
                  )}
                  <span className={s.state === "waiting" ? "text-muted" : "text-ink"}>{s.label}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      {busy && (job || elapsed > 20) && (
        <p className="mt-1.5 text-[12.5px] text-muted">
          {job
            ? "This runs in the background. You can keep working, or even close the page; it finishes on its own."
            : "You can keep working on other sections. This finishes on its own."}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-warn-soft px-3.5 py-2.5 text-[13.5px] text-warn-ink" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Swatch({ name, hex, sub }: { name: string; hex: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="h-9 w-9 shrink-0 rounded-md shadow-elev-sm" style={{ background: hex }} />
      <div className="min-w-0 leading-tight">
        <div className="truncate font-medium text-ink">{name}</div>
        <div className="code mt-0.5 text-[12px] text-muted">{sub || hex}</div>
      </div>
    </div>
  );
}
