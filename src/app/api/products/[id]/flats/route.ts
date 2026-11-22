import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { getProduct } from "@/lib/store";
import { createJob } from "@/lib/jobs";
import { Ctx, errorResponse } from "@/lib/route";
import { flatsWorkflow } from "@/workflows/flats";

/**
 * Start drawing (or redrawing) the technical flats as a background job.
 * Returns the job right away; poll /api/products/:id/jobs/:jobId for progress.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const { instruction } = (await req.json().catch(() => ({}))) as { instruction?: string };
    const product = await getProduct(id);
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!product.techPack) return NextResponse.json({ error: "Create the tech pack first." }, { status: 400 });

    const job = await createJob(id, "flats");
    await start(flatsWorkflow, [id, job.id, String(instruction ?? "").trim().slice(0, 1000)]);
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
