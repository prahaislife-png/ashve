import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { collectionProducts, deleteCollection, getCollection, saveCollection } from "@/lib/collections";
import { summarize } from "@/lib/collectionMath";
import { changeProduct } from "@/lib/route";
import { removeShare } from "@/lib/share";
import { deleteImage } from "@/lib/files";
import { Collection, CollectionFabric, CollectionStatus, PlanItem } from "@/lib/schema";

type Ctx = { params: Promise<{ id: string }> };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const str = (v: unknown, max = 500) => String(v ?? "").slice(0, max);

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await getCollection(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pieces = (await collectionProducts(c)).map(summarize);
  return NextResponse.json({ collection: c, pieces });
}

/** Edit the collection: details, palette, fabric library, sizes and the line plan. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await getCollection(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as Partial<Collection>;
  if (typeof b.name === "string" && b.name.trim()) c.name = b.name.trim().slice(0, 120);
  if (typeof b.season === "string") c.season = str(b.season, 60);
  if (b.launchDate === null || /^\d{4}-\d{2}-\d{2}$/.test(b.launchDate ?? "")) c.launchDate = b.launchDate ?? null;
  if (typeof b.story === "string") c.story = str(b.story, 4000);
  if (b.status && ["planning", "developing", "sampling", "ready", "launched"].includes(b.status)) c.status = b.status as CollectionStatus;
  if (typeof b.sizes === "string") c.sizes = str(b.sizes, 120);
  if (b.targetPieces === null || typeof b.targetPieces === "number") c.targetPieces = b.targetPieces == null ? null : Math.max(0, Math.min(200, Math.round(b.targetPieces)));
  if (Array.isArray(b.palette))
    c.palette = b.palette.slice(0, 30).map((p) => ({ name: str(p?.name, 60), pantone: str(p?.pantone, 40), hex: /^#[0-9a-f]{6}$/i.test(p?.hex ?? "") ? p.hex : "#d9d4c7" }));
  if (Array.isArray(b.fabrics))
    c.fabrics = b.fabrics.slice(0, 40).map(
      (f): CollectionFabric => ({
        id: typeof f?.id === "string" && f.id ? f.id : randomUUID(),
        name: str(f?.name, 80),
        composition: str(f?.composition, 120),
        construction: str(f?.construction, 80),
        weightGsm: num(f?.weightGsm),
        supplier: str(f?.supplier, 120),
        pricePerM: num(f?.pricePerM),
        notes: str(f?.notes, 400),
      }),
    );
  if (Array.isArray(b.plan)) {
    const old = new Map(c.plan.map((p) => [p.id, p]));
    c.plan = b.plan.slice(0, 120).map(
      (p): PlanItem => ({
        id: typeof p?.id === "string" && p.id ? p.id : randomUUID(),
        name: str(p?.name, 120) || "New piece",
        category: str(p?.category, 60),
        notes: str(p?.notes, 1000),
        colorways: Array.isArray(p?.colorways) ? p.colorways.map((x) => str(x, 60)).slice(0, 20) : [],
        targetCost: num(p?.targetCost),
        targetRetail: num(p?.targetRetail),
        // Links to products can only be made through the pieces route.
        productId: old.get(p?.id)?.productId ?? null,
      }),
    );
  }
  await saveCollection(c);
  const pieces = (await collectionProducts(c)).map(summarize);
  return NextResponse.json({ collection: c, pieces });
}

/** Delete the collection. Its products stay, they just leave the collection. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await getCollection(id);
  if (!c) return NextResponse.json({ ok: true });
  for (const p of await collectionProducts(c)) {
    await changeProduct(p.id, (prod) => {
      prod.collectionId = null;
    });
  }
  if (c.share?.token) await removeShare(c.share.token);
  await Promise.all(c.moodboard.map((f) => deleteImage(c.id, f).catch(() => {})));
  await deleteCollection(id);
  return NextResponse.json({ ok: true });
}
