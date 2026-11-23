import { NextResponse } from "next/server";
import { collectionProducts, createCollection, listCollections } from "@/lib/collections";
import { listProducts } from "@/lib/store";
import { productViews } from "@/lib/schema";

/** All collections with a few thumbnails and counts for the list page. */
export async function GET() {
  const [collections, products] = await Promise.all([listCollections(), listProducts()]);
  const out = await Promise.all(
    collections.map(async (c) => {
      const pieces = await collectionProducts(c, products);
      return {
        ...c,
        pieceCount: Math.max(c.plan.length, pieces.length),
        started: pieces.length,
        thumbs: pieces
          .map((p) => ({ productId: p.id, file: productViews(p)["product-front"]?.file }))
          .filter((t) => t.file)
          .slice(0, 4),
      };
    }),
  );
  return NextResponse.json(out);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string; season?: string; launchDate?: string; story?: string };
  const c = await createCollection({
    name: String(body.name ?? "").slice(0, 120),
    season: String(body.season ?? "").slice(0, 60),
    launchDate: /^\d{4}-\d{2}-\d{2}$/.test(body.launchDate ?? "") ? body.launchDate! : null,
    story: String(body.story ?? "").slice(0, 4000),
  });
  return NextResponse.json(c, { status: 201 });
}
