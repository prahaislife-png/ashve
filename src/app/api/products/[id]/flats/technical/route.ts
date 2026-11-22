import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { getProduct } from "@/lib/store";
import { createJob } from "@/lib/jobs";
import { Ctx, errorResponse } from "@/lib/route";
import { technicalWorkflow } from "@/workflows/technical";

/** Start adding a technical sketch (numbered construction callouts) as a background job. */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const product = await getProduct(id);
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!product.techPack || !product.flats?.at(-1)) {
      return NextResponse.json({ error: "Draw the flat sketches first." }, { status: 400 });
    }
    const job = await createJob(id, "technical");
    await start(technicalWorkflow, [id, job.id]);
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
