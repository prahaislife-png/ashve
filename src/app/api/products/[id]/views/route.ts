import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { getProduct } from "@/lib/store";
import { createJob } from "@/lib/jobs";
import { Ctx, errorResponse } from "@/lib/route";
import { MockupView, PRODUCT_VIEWS, productViews } from "@/lib/schema";
import { viewsWorkflow } from "@/workflows/views";

/**
 * Start rendering the product views (front, side, back) as a background job.
 * Body: { only?: "product-front" | "product-side" | "product-back", colorway?, note? }
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const body = (await req.json().catch(() => ({}))) as { only?: string; colorway?: string; note?: string };
    const product = await getProduct(id);
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const tp = product.techPack;
    if (!tp) return NextResponse.json({ error: "Create the tech pack first." }, { status: 400 });

    const names = tp.colorways.map((c) => c.name);
    const colorway = body.colorway && names.includes(body.colorway) ? body.colorway : (names[0] ?? "");
    let only = (PRODUCT_VIEWS as readonly string[]).includes(body.only ?? "") ? (body.only as MockupView) : null;
    // Side or back alone need a front to work from.
    if (only && only !== "product-front" && !productViews(product)["product-front"]) only = null;

    const steps = !only ? ["front", "sideback"] : only === "product-front" ? ["front"] : ["sideback"];
    const job = await createJob(id, "views", steps);
    await start(viewsWorkflow, [id, job.id, { only, colorway, note: String(body.note ?? "").slice(0, 500) }]);
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
