import { randomUUID } from "crypto";
import { Ctx as BaseCtx, mutateProduct, need } from "@/lib/route";
import { deleteImage } from "@/lib/files";
import { COMMENT_AREAS, FitComment, SAMPLE_STAGES, SampleRound, SampleStage } from "@/lib/schema";

type Ctx = BaseCtx<{ id: string; roundId: string }>;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

/** Update a sample round: status, verdict, measurements, comments, photos' captions and so on. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id, roundId } = await params;
  const body = (await req.json().catch(() => ({}))) as Partial<SampleRound> & { measuredPatch?: Record<string, unknown> };
  return mutateProduct(id, (product) => {
    const rounds = product.samples ?? [];
    const round = need(rounds.find((r) => r.id === roundId), "Sample round not found", 404);
    if (typeof body.vendor === "string") round.vendor = body.vendor.trim().slice(0, 120);
    if (body.stage && body.stage in SAMPLE_STAGES) round.stage = body.stage as SampleStage;
    if (body.status && ["requested", "received", "reviewed"].includes(body.status)) {
      round.status = body.status;
      if (body.status !== "requested" && !round.receivedAt) round.receivedAt = new Date().toISOString();
    }
    if (body.verdict === null || (body.verdict && ["approved", "revise", "rejected"].includes(body.verdict))) {
      round.verdict = body.verdict;
      // An approved pre-production or production sample means the style is approved.
      if (body.verdict === "approved" && (round.stage === "pp" || round.stage === "top")) product.status = "approved";
    }
    if (body.dueAt === null || /^\d{4}-\d{2}-\d{2}$/.test(body.dueAt ?? "")) round.dueAt = body.dueAt ?? null;
    if (body.receivedAt === null || /^\d{4}-\d{2}-\d{2}/.test(body.receivedAt ?? "")) round.receivedAt = body.receivedAt ?? null;
    if (typeof body.size === "string" && round.snapshot.sizes.includes(body.size)) round.size = body.size;
    if (typeof body.overall === "string") round.overall = body.overall.slice(0, 4000);
    if (body.sampleCost === null || typeof body.sampleCost === "number") round.sampleCost = num(body.sampleCost);
    if (body.measuredPatch && typeof body.measuredPatch === "object") {
      const codes = new Set(round.snapshot.measurements.map((m) => m.code));
      for (const [code, v] of Object.entries(body.measuredPatch)) if (codes.has(code)) round.measured[code] = num(v);
    }
    if (Array.isArray(body.comments)) {
      const photos = new Set(round.photos.map((p) => p.file));
      round.comments = body.comments.slice(0, 100).map(
        (c): FitComment => ({
          id: typeof c?.id === "string" && c.id ? c.id : randomUUID(),
          area: (COMMENT_AREAS as readonly string[]).includes(c?.area) ? c.area : "Other",
          text: String(c?.text ?? "").slice(0, 2000),
          severity: c?.severity === "major" ? "major" : "minor",
          photo: c?.photo && photos.has(c.photo) ? c.photo : null,
        }),
      );
    }
    if (Array.isArray(body.photos)) {
      // Only captions and order can change here; uploads and removals have their own routes.
      const byFile = new Map(round.photos.map((p) => [p.file, p]));
      round.photos = body.photos
        .filter((p) => byFile.has(p?.file))
        .map((p) => ({ file: p.file, caption: String(p.caption ?? "").slice(0, 200) }));
    }
  });
}

/** Delete a sample round and its photos. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id, roundId } = await params;
  return mutateProduct(id, async (product) => {
    const round = need(product.samples?.find((r) => r.id === roundId), "Sample round not found", 404);
    await Promise.all(round.photos.map((p) => deleteImage(id, p.file).catch(() => {})));
    product.samples = (product.samples ?? []).filter((r) => r.id !== roundId).map((r, i) => ({ ...r, n: i + 1 }));
  });
}
