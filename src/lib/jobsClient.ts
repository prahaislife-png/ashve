"use client";

import type { Job, Product } from "./schema";

/* ---------- jobs tray (the pill in the corner) ---------- */

export const TRAY_EVENT = "jobs:changed";
export type TrayJob = { id: string; label: string; startedAt: number };
export const trayJobs: TrayJob[] = [];

export function trayStart(id: string, label: string, startedAt = Date.now()) {
  if (trayJobs.some((j) => j.id === id)) return;
  const job = { id, label, startedAt };
  trayJobs.push(job);
  window.dispatchEvent(new CustomEvent(TRAY_EVENT, { detail: { type: "start", job } }));
}

export function trayEnd(id: string, ok: boolean) {
  const i = trayJobs.findIndex((j) => j.id === id);
  if (i < 0) return;
  const [job] = trayJobs.splice(i, 1);
  window.dispatchEvent(new CustomEvent(TRAY_EVENT, { detail: { type: "end", job, ok } }));
}

/* ---------- following a background job ---------- */

const watching = new Map<string, Promise<{ job: Job; product: Product | null }>>();

async function fetchProduct(productId: string): Promise<Product | null> {
  const res = await fetch(`/api/products/${productId}`, { cache: "no-store" });
  return res.ok ? res.json() : null;
}

/**
 * Poll a job until it finishes. Calls onProgress on every change, refreshes the
 * product each time a step completes (so the front render shows up early), and
 * returns the finished job plus the latest product.
 */
export function watchJob(
  job: Job,
  handlers: { onProgress?: (j: Job) => void; onProduct?: (p: Product) => void } = {},
): Promise<{ job: Job; product: Product | null }> {
  const existing = watching.get(job.id);
  if (existing) return existing;

  const p = (async () => {
    trayStart(job.id, job.label, Date.parse(job.createdAt) || Date.now());
    let current = job;
    let doneSteps = job.steps.filter((s) => s.state === "done").length;
    let misses = 0;
    while (current.status === "running") {
      await new Promise((r) => setTimeout(r, 2500));
      try {
        const res = await fetch(`/api/products/${job.productId}/jobs/${job.id}`, { cache: "no-store" });
        if (!res.ok) {
          if (++misses > 8) break;
          continue;
        }
        misses = 0;
        current = (await res.json()).job as Job;
        handlers.onProgress?.(current);
        const nowDone = current.steps.filter((s) => s.state === "done").length;
        if (nowDone > doneSteps && current.status === "running") {
          doneSteps = nowDone;
          const prod = await fetchProduct(job.productId);
          if (prod) handlers.onProduct?.(prod);
        }
      } catch {
        if (++misses > 8) break;
      }
    }
    const product = await fetchProduct(job.productId);
    if (product) handlers.onProduct?.(product);
    trayEnd(job.id, current.status === "done");
    watching.delete(job.id);
    return { job: current, product };
  })();
  watching.set(job.id, p);
  return p;
}
