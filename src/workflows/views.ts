import { randomUUID } from "crypto";
import { getBrand, getProduct } from "@/lib/store";
import { readImage, saveImage } from "@/lib/files";
import { buildMockupPrompt, buildViewFromFrontPrompt, generateImage } from "@/lib/imagegen";
import { changeProduct, UserError } from "@/lib/route";
import { withUsageContext } from "@/lib/usage";
import { setStep } from "@/lib/jobs";
import { MockupView, productViews } from "@/lib/schema";
import { completeJob, markFailed, toStepError } from "./shared";

type Opts = { only: MockupView | null; colorway: string; note: string };

/**
 * Product views as a background job: front first (shown as soon as it exists),
 * then side and back in parallel, both made from the front so all three match.
 */
export async function viewsWorkflow(productId: string, jobId: string, opts: Opts) {
  "use workflow";
  try {
    let frontFile: string | null = null;
    if (!opts.only || opts.only === "product-front") {
      frontFile = await renderFrontStep(productId, jobId, opts);
    }
    const others = (["product-side", "product-back"] as const).filter((v) => !opts.only || opts.only === v);
    if (others.length) {
      await markSideBack(productId, jobId, "running");
      await Promise.all(others.map((v) => renderFromFrontStep(productId, v, frontFile, opts)));
      await markSideBack(productId, jobId, "done");
    }
    await completeJob(productId, jobId);
  } catch (error) {
    await markFailed(productId, jobId, error instanceof Error ? error.message : String(error));
  }
}

async function markSideBack(productId: string, jobId: string, state: "running" | "done") {
  "use step";
  await setStep(productId, jobId, "sideback", state);
}

async function addView(productId: string, view: MockupView, file: string, opts: Opts) {
  await changeProduct(productId, (product) => {
    product.mockups = [
      ...(product.mockups ?? []),
      {
        id: randomUUID(),
        file,
        view,
        colorway: opts.colorway,
        note: opts.note,
        editedFrom: null,
        inPdf: false,
        at: new Date().toISOString(),
      },
    ];
  });
}

async function renderFrontStep(productId: string, jobId: string, opts: Opts) {
  "use step";
  try {
    await setStep(productId, jobId, "front", "running");
    const product = await getProduct(productId);
    if (!product?.techPack) throw new UserError("Create the tech pack first.");
    const refNames = product.messages.flatMap((m) => m.images ?? []).slice(-3);
    const refs = (await Promise.all(refNames.map((n) => readImage(productId, n))))
      .filter((r) => r !== null)
      .map((r) => ({ mime: r.mime, data: r.buffer }));
    const prompt = buildMockupPrompt({
      techPack: product.techPack,
      brand: await getBrand(),
      view: "product-front",
      colorway: opts.colorway,
      note: opts.note,
      hasReferences: refs.length > 0,
    });
    const img = await withUsageContext(productId, product.name, () =>
      generateImage(prompt, refs, undefined, "Product views"),
    );
    const file = await saveImage(productId, "mockup", img.mime, img.data);
    await addView(productId, "product-front", file, opts);
    await setStep(productId, jobId, "front", "done");
    return file;
  } catch (error) {
    throw toStepError(error);
  }
}
renderFrontStep.maxRetries = 1;

async function renderFromFrontStep(
  productId: string,
  view: "product-side" | "product-back",
  frontFile: string | null,
  opts: Opts,
) {
  "use step";
  try {
    const product = await getProduct(productId);
    if (!product?.techPack) throw new UserError("Create the tech pack first.");
    const file = frontFile ?? productViews(product)["product-front"]?.file;
    const front = file ? await readImage(productId, file) : null;
    if (!front) throw new UserError("Render the front view first.");
    const img = await withUsageContext(productId, product.name, () =>
      generateImage(
        buildViewFromFrontPrompt(view, product.techPack!),
        [{ mime: front.mime, data: front.buffer }],
        undefined,
        "Product views",
      ),
    );
    await addView(productId, view, await saveImage(productId, "mockup", img.mime, img.data), opts);
  } catch (error) {
    throw toStepError(error);
  }
}
renderFromFrontStep.maxRetries = 1;
