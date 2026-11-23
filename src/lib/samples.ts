import type { SampleRound, SampleStage } from "./schema";

/** Spec, measured and difference for each point of measure on a sample (all cm). */
export function sampleRows(round: SampleRound) {
  const snap = round.snapshot;
  const idx = Math.max(0, snap.sizes.indexOf(round.size));
  return snap.measurements.map((m) => {
    const spec = m.values[idx] ?? null;
    const got = round.measured[m.code] ?? null;
    const diff = spec != null && got != null ? Math.round((got - spec) * 100) / 100 : null;
    const out = diff != null && Math.abs(diff) > m.toleranceCm + 1e-9;
    return { code: m.code, name: m.name, tol: m.toleranceCm, spec, got, diff, out };
  });
}

/** The usual next stage after this one. */
export function nextStage(stage: SampleStage | undefined): SampleStage {
  const order: SampleStage[] = ["proto", "fit", "size-set", "pp", "top"];
  if (!stage) return "proto";
  const i = order.indexOf(stage);
  return order[Math.min(order.length - 1, i + 1)];
}
