import { NextResponse } from "next/server";
import { collectionProducts, getCollection, saveCollection } from "@/lib/collections";
import { newToken, removeShare, saveCollectionShare, saveShare } from "@/lib/share";
import { changeProduct } from "@/lib/route";

type Ctx = { params: Promise<{ id: string }> };

/**
 * One vendor link for the whole collection: a line sheet page that links to each
 * piece's own read-only tech pack. Pieces without a factory link get one, and those
 * links are turned off again with the collection link.
 */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await getCollection(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.share?.token) await removeShare(c.share.token);
  const made: string[] = [...(c.share?.productTokens ?? [])];
  for (const p of await collectionProducts(c)) {
    if (!p.techPack || p.share?.token) continue;
    const token = newToken();
    await saveShare(token, p.id);
    await changeProduct(p.id, (prod) => {
      prod.share = { token, createdAt: new Date().toISOString() };
    });
    made.push(token);
  }
  const token = newToken();
  await saveCollectionShare(token, c.id);
  c.share = { token, createdAt: new Date().toISOString(), productTokens: made };
  await saveCollection(c);
  return NextResponse.json(c);
}

/** Turn the collection link off, with the piece links it created. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await getCollection(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.share?.token) await removeShare(c.share.token);
  const auto = new Set(c.share?.productTokens ?? []);
  for (const p of await collectionProducts(c)) {
    if (p.share?.token && auto.has(p.share.token)) {
      await removeShare(p.share.token);
      await changeProduct(p.id, (prod) => {
        prod.share = null;
      });
    }
  }
  c.share = null;
  await saveCollection(c);
  return NextResponse.json(c);
}
