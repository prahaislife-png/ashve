import { NextResponse } from "next/server";
import { activeJobs } from "@/lib/jobs";
import { Ctx } from "@/lib/route";

export const dynamic = "force-dynamic";

/** Background jobs still running for this product (so a reloaded page can keep showing them). */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return NextResponse.json({ jobs: await activeJobs(id) });
}
