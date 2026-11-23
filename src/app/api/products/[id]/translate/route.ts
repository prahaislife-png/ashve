import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { getProduct } from "@/lib/store";
import { createJob } from "@/lib/jobs";
import { Ctx, errorResponse, mutateProduct } from "@/lib/route";
import { LANGUAGES, languageOf } from "@/lib/locale";
import { translateWorkflow } from "@/workflows/translate";

/** Start translating the tech pack into a vendor language (background job). Body: { lang } */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const { lang } = (await req.json().catch(() => ({}))) as { lang?: string };
    if (!lang || lang === "en" || !LANGUAGES.some((l) => l.code === lang)) {
      return NextResponse.json({ error: "Choose a language." }, { status: 400 });
    }
    const product = await getProduct(id);
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!product.techPack) return NextResponse.json({ error: "Create the tech pack first." }, { status: 400 });
    const job = await createJob(id, "translate", undefined, `Translation: ${languageOf(lang).name}`);
    await start(translateWorkflow, [id, job.id, lang]);
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Remove a translation. ?lang=hi */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const lang = new URL(req.url).searchParams.get("lang") ?? "";
  return mutateProduct(id, (product) => {
    const next = { ...(product.translations ?? {}) };
    delete next[lang];
    product.translations = next;
  });
}
