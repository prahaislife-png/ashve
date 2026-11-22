"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Activity, Check, ChevronDown, Loader2, X } from "lucide-react";
import { TRAY_EVENT as EVENT, TrayJob, trayEnd, trayJobs as jobs, trayStart } from "@/lib/jobsClient";

type Group = { name: string; cost: number; count: number };
type Summary = {
  month: string;
  totalUsd: number;
  todayUsd: number;
  count: number;
  byKind: Group[];
  byProvider: Group[];
  byProduct: Group[];
  recent: { at: string; kind: string; productName: string | null; costUsd: number; provider: string }[];
};
type Job = TrayJob;
type Toast = { id: string; text: string; ok: boolean };

export function money(v: number) {
  if (v === 0) return "$0.00";
  if (v < 0.01) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(2)}`;
}

function elapsed(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

/** Name an AI request from its URL and body. Returns null for requests that don't run AI. */
function jobLabel(url: string, body: unknown): string | null {
  let b: Record<string, unknown> = {};
  try {
    b = typeof body === "string" ? JSON.parse(body) : {};
  } catch {
    // not JSON
  }
  if (b.mode === "upload") return null;
  const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
  const m = /^\/api\/products\/[^/]+\/(.+)$/.exec(path);
  if (!m) return null;
  const rest = m[1];
  if (rest === "chat") return "Tech pack update";
  if (rest === "mockups") return "Mockup";
  if (/^mockups\/[^/]+$/.test(rest)) return "Mockup edit";
  if (rest === "details") return b.action === "suggest" ? "Detail finder" : null;
  if (/^details\/[^/]+$/.test(rest)) return "Close-up";
  if (rest === "prints") return "Print file";
  if (rest === "labels") return "Label design";
  if (rest === "rfq") return "Quote email";
  return null;
}


/** Wrap fetch once so every AI request shows up as a running job. */
function installFetchHook() {
  const w = window as unknown as { __jobsHooked?: boolean };
  if (w.__jobsHooked) return;
  w.__jobsHooked = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const label = method === "POST" ? jobLabel(url, init?.body) : null;
    if (!label) return original(input, init);
    const id = `req-${Math.random().toString(36).slice(2)}`;
    trayStart(id, label);
    let ok = false;
    try {
      const res = await original(input, init);
      ok = res.ok;
      return res;
    } finally {
      trayEnd(id, ok);
    }
  };
}

export default function UsageWidget() {
  const path = usePathname();
  // Hidden on login, the printable PDF, and factory links (factories don't see her usage).
  const hidden = path === "/login" || /\/print$/.test(path) || path.startsWith("/f/");
  const [data, setData] = useState<Summary | null>(null);
  const [running, setRunning] = useState<Job[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/usage", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      // offline: keep the last numbers
    }
  }, []);

  useEffect(() => {
    if (hidden) return;
    installFetchHook();
    setRunning([...jobs]);
    load();
    const onJobs = (e: Event) => {
      const d = (e as CustomEvent<{ type: string; job: Job; ok?: boolean }>).detail;
      setRunning([...jobs]);
      if (d.type === "end") {
        load();
        // Only announce jobs long enough that she may have looked away.
        if (Date.now() - d.job.startedAt > 8000) {
          const t: Toast = { id: d.job.id, ok: !!d.ok, text: d.ok ? `${d.job.label} ready` : `${d.job.label} failed` };
          setToasts((ts) => [...ts, t]);
          setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== t.id)), 7000);
        }
      }
    };
    const onVisible = () => document.visibilityState === "visible" && load();
    window.addEventListener(EVENT, onJobs);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(EVENT, onJobs);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hidden, load]);

  // Keep the elapsed timers moving while something runs.
  useEffect(() => {
    if (running.length === 0) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running.length]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (hidden) return null;

  const monthName = data
    ? new Date(`${data.month}-01T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "";
  const max = Math.max(0.000001, ...(data?.byKind.map((k) => k.cost) ?? [0]));
  const first = running[0];

  return (
    <div ref={box} className="usage-widget no-print fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Finished-job notices */}
      <div aria-live="polite" className="flex flex-col items-end gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="card flex items-center gap-2.5 px-3.5 py-2.5 text-[13.5px] text-ink">
            {t.ok ? <Check size={15} className="text-ok" /> : <X size={15} className="text-danger" />}
            {t.text}
            <button
              className="ml-1 text-muted hover:text-ink"
              aria-label="Dismiss"
              onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>

      {open && data && (
        <div className="card max-h-[70vh] w-[330px] overflow-y-auto p-4 text-[13.5px]" role="dialog" aria-label="Usage and jobs">
          {running.length > 0 && (
            <div className="mb-4">
              <div className="field-label mb-1.5">Running now</div>
              <ul className="space-y-1">
                {running.map((j) => (
                  <li key={j.id} className="flex items-center gap-2">
                    <Loader2 size={13} className="animate-spin text-accent" />
                    <span className="flex-1 text-ink">{j.label}</span>
                    <span className="num text-muted">{elapsed(Date.now() - j.startedAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-baseline justify-between">
            <div className="h-title text-[16px]">Usage in {monthName}</div>
            <button className="text-muted hover:text-ink" aria-label="Close" onClick={() => setOpen(false)}>
              <ChevronDown size={16} />
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {[
              { k: "This month", v: money(data.totalUsd) },
              { k: "Today", v: money(data.todayUsd) },
              { k: "AI actions", v: String(data.count) },
            ].map((x) => (
              <div key={x.k} className="rounded-lg bg-panel px-2.5 py-2">
                <dt className="text-[11.5px] text-muted">{x.k}</dt>
                <dd className="num text-[16px] font-semibold text-ink">{x.v}</dd>
              </div>
            ))}
          </dl>

          {data.byKind.length > 0 ? (
            <>
              <div className="field-label mb-1.5 mt-4">By type</div>
              <ul className="space-y-2">
                {data.byKind.map((k) => (
                  <li key={k.name}>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-ink">
                        {k.name} <span className="text-muted">×{k.count}</span>
                      </span>
                      <span className="num text-ink">{money(k.cost)}</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(k.cost / max) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>

              <div className="field-label mb-1.5 mt-4">By service</div>
              <ul className="space-y-0.5 text-[13px]">
                {data.byProvider.map((p) => (
                  <li key={p.name} className="flex justify-between">
                    <span className="text-ink-2">{p.name}</span>
                    <span className="num text-ink">{money(p.cost)}</span>
                  </li>
                ))}
              </ul>

              <div className="field-label mb-1.5 mt-4">By product</div>
              <ul className="space-y-0.5 text-[13px]">
                {data.byProduct.map((p) => (
                  <li key={p.name} className="flex justify-between gap-2">
                    <span className="truncate text-ink-2">{p.name}</span>
                    <span className="num shrink-0 text-ink">{money(p.cost)}</span>
                  </li>
                ))}
              </ul>

              <div className="field-label mb-1.5 mt-4">Latest</div>
              <ul className="space-y-1 text-[12.5px]">
                {data.recent.map((r, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate text-ink-2">
                      <span className="num text-muted">
                        {new Date(r.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>{" "}
                      {r.kind}
                      {r.productName ? <span className="text-muted">, {r.productName}</span> : null}
                    </span>
                    <span className="num shrink-0 text-ink">{money(r.costUsd)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-4 text-[13px] text-muted">No AI actions yet this month.</p>
          )}

          <p className="mt-4 border-t border-line pt-2 text-[11.5px] leading-snug text-muted">
            Estimated from the tokens each request used, at Anthropic and OpenAI list prices. Your bills on their
            websites are the final word.
          </p>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full bg-card px-3.5 py-2 text-[13px] text-ink shadow-elev-md transition-shadow hover:shadow-elev-lg"
        aria-label={first ? `${running.length} AI jobs running. Usage this month` : "Usage this month"}
        aria-expanded={open}
      >
        {first ? (
          <>
            <Loader2 size={14} className="animate-spin text-accent" />
            <span className="font-medium">{first.label}</span>
            <span className="num text-muted">{elapsed(Date.now() - first.startedAt)}</span>
            {running.length > 1 && <span className="text-muted">and {running.length - 1} more</span>}
          </>
        ) : (
          <>
            <Activity size={14} className="text-accent" />
            <span className="num font-semibold">{data ? money(data.totalUsd) : "…"}</span>
            <span className="text-muted">this month</span>
          </>
        )}
      </button>
    </div>
  );
}
