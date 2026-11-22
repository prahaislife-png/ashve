import { NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";
import { Ctx } from "@/lib/route";

export const dynamic = "force-dynamic";

/** One job's progress. */
export async function GET(_req: Request, { params }: Ctx<{ id: string; jobId: string }>) {
  const { id, jobId } = await params;
  try {
    const job = await getJob(id, jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json({ job });
  } catch {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
}
