import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { applyTechPack, deleteProduct, getProduct } from "@/lib/store";
import { MeasureMeta, ProductStatus, TechPackSchema } from "@/lib/schema";
import { mutateProduct, need, UserError } from "@/lib/route";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(product);
}

function cleanMeta(raw: unknown): Record<string, MeasureMeta> {
  const out: Record<string, MeasureMeta> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [code, v] of Object.entries(raw as Record<string, Partial<MeasureMeta>>)) {
    if (!v || typeof v !== "object") continue;
    out[code.slice(0, 20)] = {
      source: v.source === "edited" || v.source === "rule" ? v.source : "ai",
      verified: v.verified === true,
      grade: typeof v.grade === "number" && Number.isFinite(v.grade) ? Math.round(v.grade * 100) / 100 : null,
    };
  }
  return out;
}

/**
 * Manual edits: rename, change status, save an edited tech pack (with measurement
 * trust info), restore an automatic revision, or save / restore / delete a named version.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    status?: ProductStatus;
    techPack?: unknown;
    measureMeta?: unknown;
    restoreRevision?: number;
    saveVersion?: string;
    restoreVersion?: string;
    deleteVersion?: string;
  };

  return mutateProduct(id, (product) => {
    if (typeof body.name === "string" && body.name.trim()) product.name = body.name.trim().slice(0, 120);
    if (body.status && ["draft", "sampling", "approved"].includes(body.status)) {
      product.status = body.status;
    }
    if (body.techPack !== undefined) {
      const parsed = TechPackSchema.safeParse(body.techPack);
      if (!parsed.success) throw new UserError("Tech pack is not in the right format");
      applyTechPack(product, parsed.data);
    }
    // Her own edits, grading and "verified" ticks (applied after any tech pack change).
    if (body.measureMeta !== undefined) {
      const codes = new Set(product.techPack?.measurements.map((m) => m.code));
      const incoming = cleanMeta(body.measureMeta);
      product.measureMeta = { ...(product.measureMeta ?? {}) };
      for (const [code, m] of Object.entries(incoming)) if (codes.has(code)) product.measureMeta[code] = m;
    }
    if (typeof body.restoreRevision === "number") {
      const rev = need(product.revisions[body.restoreRevision], "Revision not found", 404);
      applyTechPack(product, rev.techPack);
    }
    if (typeof body.saveVersion === "string") {
      const tp = need(product.techPack, "Create the tech pack first.");
      const name = body.saveVersion.trim().slice(0, 80) || `Version ${(product.versions?.length ?? 0) + 1}`;
      product.versions = [
        ...(product.versions ?? []),
        { id: randomUUID(), name, at: new Date().toISOString(), techPack: tp, measureMeta: product.measureMeta ?? {} },
      ];
    }
    if (typeof body.restoreVersion === "string") {
      const v = need(product.versions?.find((x) => x.id === body.restoreVersion), "Version not found", 404);
      // Restoring keeps today's tech pack in the automatic history, so nothing is lost.
      applyTechPack(product, v.techPack);
      product.measureMeta = { ...v.measureMeta };
    }
    if (typeof body.deleteVersion === "string") {
      product.versions = (product.versions ?? []).filter((x) => x.id !== body.deleteVersion);
    }
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await deleteProduct(id);
  return NextResponse.json({ ok: true });
}
