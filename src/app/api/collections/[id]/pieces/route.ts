import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { collectionProducts, getCollection, saveCollection } from "@/lib/collections";
import { summarize } from "@/lib/collectionMath";
import { createProduct, getProduct } from "@/lib/store";
import { changeProduct, errorResponse, UserError } from "@/lib/route";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Line-plan actions:
 *  { action: "plan", name, category, notes, colorways }  add an idea
 *  { action: "add", productId }                           bring an existing product in
 *  { action: "start", planId }                            create the product for an idea
 *  { action: "remove", planId }                           take a slot out (the product stays)
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const c = await getCollection(id);
    if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const b = (await req.json().catch(() => ({}))) as {
      action?: string;
      name?: string;
      category?: string;
      notes?: string;
      colorways?: string[];
      productId?: string;
      planId?: string;
    };
    let brief: { productId: string; text: string } | null = null;

    if (b.action === "plan") {
      c.plan.push({
        id: randomUUID(),
        name: String(b.name ?? "").trim().slice(0, 120) || "New piece",
        category: String(b.category ?? "").slice(0, 60),
        notes: String(b.notes ?? "").slice(0, 1000),
        colorways: Array.isArray(b.colorways) ? b.colorways.map(String).slice(0, 20) : [],
        targetCost: null,
        targetRetail: null,
        productId: null,
      });
    } else if (b.action === "add") {
      const product = await getProduct(String(b.productId ?? ""));
      if (!product) throw new UserError("Product not found", 404);
      if (product.collectionId && product.collectionId !== c.id) {
        // Move it: take it out of the other collection's plan.
        const other = await getCollection(product.collectionId);
        if (other) {
          other.plan = other.plan.filter((p) => p.productId !== product.id);
          await saveCollection(other);
        }
      }
      await changeProduct(product.id, (p) => {
        p.collectionId = c.id;
      });
      if (!c.plan.some((p) => p.productId === product.id)) {
        c.plan.push({
          id: randomUUID(),
          name: product.techPack?.styleName || product.name,
          category: product.techPack?.subcategory || product.techPack?.category || "",
          notes: "",
          colorways: product.techPack?.colorways.map((x) => x.name) ?? [],
          targetCost: null,
          targetRetail: null,
          productId: product.id,
        });
      }
    } else if (b.action === "start") {
      const slot = c.plan.find((p) => p.id === b.planId);
      if (!slot) throw new UserError("Piece not found", 404);
      if (slot.productId && (await getProduct(slot.productId))) throw new UserError("This piece already has a product.");
      const product = await createProduct(slot.name, true);
      await changeProduct(product.id, (p) => {
        p.collectionId = c.id;
      });
      slot.productId = product.id;
      const parts = [
        `Design the ${slot.name}${slot.category ? ` (${slot.category})` : ""} for my "${c.name}" collection.`,
        slot.notes,
        slot.colorways.length ? `Colourways: ${slot.colorways.join(", ")}.` : "",
        slot.targetRetail != null ? `Target retail price ${slot.targetRetail}.` : "",
        slot.targetCost != null ? `Target factory cost ${slot.targetCost}.` : "",
      ];
      brief = { productId: product.id, text: parts.filter(Boolean).join(" ") };
    } else if (b.action === "remove") {
      const slot = c.plan.find((p) => p.id === b.planId);
      if (slot?.productId) {
        await changeProduct(slot.productId, (p) => {
          if (p.collectionId === c.id) p.collectionId = null;
        });
      }
      c.plan = c.plan.filter((p) => p.id !== b.planId);
    } else if (b.action === "detach") {
      // A piece that is in the collection but not in the plan.
      await changeProduct(String(b.productId ?? ""), (p) => {
        if (p.collectionId === c.id) p.collectionId = null;
      });
    } else {
      throw new UserError("Unknown action");
    }

    await saveCollection(c);
    const pieces = (await collectionProducts(c)).map(summarize);
    return NextResponse.json({ collection: c, pieces, brief });
  } catch (error) {
    return errorResponse(error);
  }
}
