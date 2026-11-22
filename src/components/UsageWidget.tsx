"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Activity, ChevronDown, Loader2 } from "lucide-react";

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

export function money(v: number) {
  if (v === 0) return "$0.00";
  if (v < 0.01) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(2)}`;
}

const REFRESH = "usage:refresh";
const RUNNING = "usage:running";
let inFlight = 0;

/**
 * Wrap fetch once so every AI action (POST/PATCH/DELETE to /api/products/...)
 * shows as "running" and refreshes the totals when it finishes.
 */
function installFetchHook() {
  const w = window as unknown as { __usageHooked?: boolean };
  if (w.__usageHooked) return;
  w.__usageHooked = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const tracked = method === "POST" && /\/api\/products\/[^/]+\//.test(url);
    if (!tracked) return original(input, init);
    inFlight++;
    window.dispatchEvent(new CustomEvent(RUNNING, { detail: inFlight }));
    try {
      return await original(input, init);
    } finally {
      inFlight = Math.max(0, inFlight - 1);
      window.dispatchEvent(new CustomEvent(RUNNING, { detail: inFlight }));
      window.dispatchEvent(new Event(REFRESH));
    }
  };
}

export default function UsageWidget() {
  const path = usePathname();
  const hidden = path === "/login" || /\/print$/.test(path);
  const [data, setData] = useState<Summary | null>(null);
  const [running, setRunning] = useState(0);
  const [open, setOpen] = useState(false);
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
    load();
    const onRefresh = () => load();
    const onRunning = (e: Event) => setRunning((e as CustomEvent<number>).detail);
    const onVisible = () => document.visibilityState === "visible" && load();
    window.addEventListener(REFRESH, onRefresh);
    window.addEventListener(RUNNING, onRunning);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(REFRESH, onRefresh);
      window.removeEventListener(RUNNING, onRunning);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hidden, load]);

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

  return (
    <div ref={box} className="usage-widget no-print fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {open && data && (
        <div className="card mb-2 max-h-[70vh] w-[320px] overflow-y-auto p-4 text-sm shadow-xl">
          <div className="flex items-baseline justify-between">
            <div className="h-title">Usage · {monthName}</div>
            <button className="text-muted" aria-label="Close" onClick={() => setOpen(false)}>
              <ChevronDown size={16} />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-panel p-2">
              <div className="text-base font-semibold">{money(data.totalUsd)}</div>
              <div className="text-[11px] text-muted">this month</div>
            </div>
            <div className="rounded-lg bg-panel p-2">
              <div className="text-base font-semibold">{money(data.todayUsd)}</div>
              <div className="text-[11px] text-muted">today</div>
            </div>
            <div className="rounded-lg bg-panel p-2">
              <div className="text-base font-semibold">{data.count}</div>
              <div className="text-[11px] text-muted">AI actions</div>
            </div>
          </div>

          {data.byKind.length > 0 ? (
            <>
              <div className="field-label mb-1.5 mt-4">By type</div>
              <ul className="space-y-1.5">
                {data.byKind.map((k) => (
                  <li key={k.name}>
                    <div className="flex justify-between text-[13px]">
                      <span>
                        {k.name} <span className="text-muted">×{k.count}</span>
                      </span>
                      <span className="tabular-nums">{money(k.cost)}</span>
                    </div>
                    <div className="mt-0.5 h-1 overflow-hidden rounded bg-accent-soft">
                      <div className="h-full bg-accent" style={{ width: `${(k.cost / max) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>

              <div className="field-label mb-1.5 mt-4">By service</div>
              <ul className="space-y-0.5 text-[13px]">
                {data.byProvider.map((p) => (
                  <li key={p.name} className="flex justify-between">
                    <span>{p.name}</span>
                    <span className="tabular-nums">{money(p.cost)}</span>
                  </li>
                ))}
              </ul>

              <div className="field-label mb-1.5 mt-4">By product</div>
              <ul className="space-y-0.5 text-[13px]">
                {data.byProduct.map((p) => (
                  <li key={p.name} className="flex justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 tabular-nums">{money(p.cost)}</span>
                  </li>
                ))}
              </ul>

              <div className="field-label mb-1.5 mt-4">Latest</div>
              <ul className="space-y-1 text-[12px]">
                {data.recent.map((r, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <span className="text-muted">
                        {new Date(r.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>{" "}
                      {r.kind}
                      {r.productName ? <span className="text-muted"> · {r.productName}</span> : null}
                    </span>
                    <span className="shrink-0 tabular-nums">{money(r.costUsd)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-4 text-[13px] text-muted">No AI actions yet this month.</p>
          )}

          <p className="mt-4 border-t border-line pt-2 text-[11px] leading-snug text-muted">
            Estimated from the tokens each request used, at Anthropic and OpenAI list prices. Your
            bills on their websites are the final word.
          </p>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-line bg-card/95 px-3 py-1.5 text-[12.5px] shadow-md backdrop-blur hover:border-accent"
        aria-label="Usage this month"
        aria-expanded={open}
      >
        {running > 0 ? (
          <Loader2 size={13} className="animate-spin text-accent" />
        ) : (
          <Activity size={13} className="text-accent" />
        )}
        <span className="font-semibold tabular-nums">{data ? money(data.totalUsd) : "…"}</span>
        <span className="text-muted">this month</span>
        {data && data.todayUsd > 0 && (
          <span className="hidden text-muted sm:inline">· {money(data.todayUsd)} today</span>
        )}
        {running > 0 && <span className="text-accent">· {running} running</span>}
      </button>
    </div>
  );
}
