import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { collectionProducts, getCollection, saveCollection } from "@/lib/collections";
import { summarize } from "@/lib/collectionMath";
import { getBrand } from "@/lib/store";
import { suggestPieces } from "@/lib/ai";
import { errorResponse } from "@/lib/route";
import { withUsageContext } from "@/lib/usage";

export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

/** Claude suggests pieces that round out the line plan; they are added as ideas. Body: { count } */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const c = await getCollection(id);
    if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { count } = (await req.json().catch(() => ({}))) as { count?: number };
    const n = Math.max(1, Math.min(8, Math.round(count ?? 4)));
    const brand = await getBrand();
    const result = await withUsageContext(c.id, `Collection: ${c.name}`, () =>
      suggestPieces({
        collection: {
          name: c.name,
          season: c.season,
          story: c.story,
          palette: c.palette.map((p) => ({ name: p.name, hex: p.hex })),
          fabrics: c.fabrics.map((f) => `${f.name}: ${f.composition} ${f.construction}${f.weightGsm ? ` ${f.weightGsm} GSM` : ""}`),
          sizes: c.sizes,
          targetPieces: c.targetPieces,
        },
        existing: c.plan.map((p) => ({ name: p.name, category: p.category, notes: p.notes })),
        brand,
        count: n,
      }),
    );
    const names = new Set(c.palette.map((p) => p.name));
    for (const s of result.pieces.slice(0, n)) {
      c.plan.push({
        id: randomUUID(),
        name: s.name.slice(0, 120),
        category: s.category.slice(0, 60),
        notes: [s.notes, s.fabric && `Fabric: ${s.fabric}.`].filter(Boolean).join(" ").slice(0, 1000),
        colorways: s.colorways.filter((x) => names.has(x)).slice(0, 8),
        targetCost: null,
        targetRetail: null,
        productId: null,
      });
    }
    await saveCollection(c);
    const pieces = (await collectionProducts(c)).map(summarize);
    return NextResponse.json({ collection: c, pieces, rationale: result.rationale });
  } catch (error) {
    return errorResponse(error);
  }
}
