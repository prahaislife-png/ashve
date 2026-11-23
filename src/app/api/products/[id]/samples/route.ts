import { randomUUID } from "crypto";
import { Ctx, mutateProduct, need } from "@/lib/route";
import { SAMPLE_STAGES, SampleRound, SampleStage } from "@/lib/schema";

/** Start a sample round: the vendor gets today's tech pack, saved as a version. Body: { stage, vendor, dueAt, size } */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { stage?: string; vendor?: string; dueAt?: string; size?: string };
  return mutateProduct(id, (product) => {
    const tp = need(product.techPack, "Create the tech pack first.");
    const rounds = product.samples ?? [];
    const stage = (body.stage && body.stage in SAMPLE_STAGES ? body.stage : "proto") as SampleStage;
    const n = rounds.length + 1;
    const now = new Date().toISOString();
    const vendor = String(body.vendor ?? "").trim().slice(0, 120);
    const round: SampleRound = {
      id: randomUUID(),
      n,
      stage,
      vendor,
      status: "requested",
      verdict: null,
      requestedAt: now,
      dueAt: /^\d{4}-\d{2}-\d{2}$/.test(body.dueAt ?? "") ? body.dueAt! : null,
      receivedAt: null,
      size: tp.sizes.includes(body.size ?? "") ? body.size! : tp.baseSize,
      photos: [],
      measured: {},
      comments: [],
      overall: "",
      sampleCost: null,
      snapshot: structuredClone(tp),
      revision: null,
    };
    product.samples = [...rounds, round];
    product.versions = [
      ...(product.versions ?? []),
      {
        id: randomUUID(),
        name: `Sample ${n}: ${SAMPLE_STAGES[stage]}${vendor ? ` to ${vendor}` : ""}`,
        at: now,
        techPack: structuredClone(tp),
        measureMeta: product.measureMeta ?? {},
      },
    ];
    if (product.status === "draft") product.status = "sampling";
  });
}
