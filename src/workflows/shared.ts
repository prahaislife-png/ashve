import { FatalError } from "workflow";
import { failJob, finishJob, setStep } from "@/lib/jobs";

/**
 * Errors from AI providers or bad input won't get better on a retry, and a retry
 * would be charged again, so they stop the job. Network blips may retry once.
 * (AiError, ImageGenError and UserError carry `userFacing = true`; checking the flag
 * keeps those Node-only modules out of the workflow sandbox bundle.)
 */
export function toStepError(error: unknown): Error {
  if (error && typeof error === "object" && (error as { userFacing?: boolean }).userFacing) {
    return new FatalError((error as Error).message);
  }
  return error instanceof Error ? error : new Error(String(error));
}

export async function markStep(productId: string, jobId: string, step: string, state: "running" | "done") {
  "use step";
  await setStep(productId, jobId, step, state);
}

export async function completeJob(productId: string, jobId: string) {
  "use step";
  await finishJob(productId, jobId);
}

export async function markFailed(productId: string, jobId: string, message: string) {
  "use step";
  await failJob(productId, jobId, message || "Something went wrong. Please try again.");
}
