import "server-only";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { Job, JobKind } from "./schema";

/**
 * Background job records: what a long AI task is doing, step by step.
 * Stored at jobs/<productId>/<jobId>.json so the product page can find
 * running jobs after a reload.
 */

const STEPS: Record<JobKind, { label: string; steps: { key: string; label: string }[] }> = {
  flats: {
    label: "Flat sketches",
    steps: [
      { key: "frontback", label: "Drawing front and back flats" },
      { key: "guide", label: "Adding the measurement guide" },
      { key: "save", label: "Saving the drawings" },
    ],
  },
  views: {
    label: "Product views",
    steps: [
      { key: "front", label: "Rendering the front" },
      { key: "sideback", label: "Rendering side and back from the front" },
    ],
  },
  translate: {
    label: "Translation",
    steps: [
      { key: "translate", label: "Translating the tech pack" },
      { key: "save", label: "Saving the translation" },
    ],
  },
  technical: {
    label: "Technical sketch",
    steps: [
      { key: "callouts", label: "Adding construction callouts" },
      { key: "save", label: "Saving the sketch" },
    ],
  },
};

const key = (productId: string, jobId: string) => {
  if (!/^[a-f0-9-]{36}$/.test(productId) || !/^[a-f0-9-]{36}$/.test(jobId)) throw new Error("Invalid id");
  return `jobs/${productId}/${jobId}.json`;
};

async function write(job: Job) {
  await storage.write(key(job.productId, job.id), Buffer.from(JSON.stringify(job), "utf8"), "application/json");
}

export async function createJob(productId: string, kind: JobKind, only?: string[], label?: string): Promise<Job> {
  const def = STEPS[kind];
  const job: Job = {
    id: randomUUID(),
    productId,
    kind,
    label: label ?? def.label,
    status: "running",
    steps: def.steps
      .filter((s) => !only || only.includes(s.key))
      .map((s) => ({ ...s, state: "waiting" as const })),
    error: null,
    createdAt: new Date().toISOString(),
    finishedAt: null,
  };
  await write(job);
  return job;
}

export async function getJob(productId: string, jobId: string): Promise<Job | null> {
  const buf = await storage.read(key(productId, jobId));
  return buf ? (JSON.parse(buf.toString("utf8")) as Job) : null;
}

async function update(productId: string, jobId: string, fn: (j: Job) => void) {
  const job = await getJob(productId, jobId);
  if (!job) return;
  fn(job);
  await write(job);
}

export const setStep = (productId: string, jobId: string, stepKey: string, state: Job["steps"][number]["state"]) =>
  update(productId, jobId, (j) => {
    const s = j.steps.find((x) => x.key === stepKey);
    if (s) s.state = state;
  });

export const finishJob = (productId: string, jobId: string) =>
  update(productId, jobId, (j) => {
    j.status = "done";
    j.finishedAt = new Date().toISOString();
    j.steps.forEach((s) => (s.state = "done"));
  });

export const failJob = (productId: string, jobId: string, error: string) =>
  update(productId, jobId, (j) => {
    j.status = "failed";
    j.error = error;
    j.finishedAt = new Date().toISOString();
    j.steps.forEach((s) => {
      if (s.state === "running") s.state = "failed";
    });
  });

/** Jobs still running for a product. Jobs stuck "running" for over 20 minutes are treated as failed. */
export async function activeJobs(productId: string): Promise<Job[]> {
  if (!/^[a-f0-9-]{36}$/.test(productId)) return [];
  const keys = (await storage.list(`jobs/${productId}/`)).filter((k) => k.endsWith(".json"));
  const jobs = await Promise.all(
    keys.map(async (k) => {
      const buf = await storage.read(k);
      return buf ? (JSON.parse(buf.toString("utf8")) as Job) : null;
    }),
  );
  const cutoff = Date.now() - 20 * 60 * 1000;
  return jobs.filter((j): j is Job => !!j && j.status === "running" && Date.parse(j.createdAt) > cutoff);
}
