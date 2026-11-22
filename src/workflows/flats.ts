import { randomUUID } from "crypto";
import { drawFlats, drawMeasurementGuide } from "@/lib/ai";
import { readImage, sanitizeSvg, saveImage } from "@/lib/files";
import { getProduct } from "@/lib/store";
import { changeProduct, UserError } from "@/lib/route";
import { withUsageContext } from "@/lib/usage";
import { setStep } from "@/lib/jobs";
import { completeJob, markFailed, toStepError } from "./shared";

/**
 * Flat sketches as a background job:
 * 1. front + back flats (one Claude call)  2. measurement guide from the front  3. save the set.
 * Each step is retried at most once, and only for network errors.
 */
export async function flatsWorkflow(productId: string, jobId: string, instruction: string) {
  "use workflow";
  try {
    const fb = await drawFrontBackStep(productId, jobId, instruction);
    const guide = await drawGuideStep(productId, jobId, fb.front);
    await saveFlatSetStep(productId, jobId, fb, guide);
    await completeJob(productId, jobId);
  } catch (error) {
    await markFailed(productId, jobId, error instanceof Error ? error.message : String(error));
  }
}

async function drawFrontBackStep(productId: string, jobId: string, instruction: string) {
  "use step";
  try {
    await setStep(productId, jobId, "frontback", "running");
    const product = await getProduct(productId);
    if (!product?.techPack) throw new UserError("Create the tech pack first.");

    // Revise the current set when there is one.
    const current = product.flats?.at(-1);
    let previous: { front: string; back: string } | null = null;
    if (current) {
      const [f, b] = await Promise.all([readImage(productId, current.front), readImage(productId, current.back)]);
      if (f && b) previous = { front: f.buffer.toString("utf8"), back: b.buffer.toString("utf8") };
    }
    // Let Claude look at the front product view and up to 2 reference photos.
    const view = product.mockups?.filter((m) => m.view === "product-front").at(-1)?.file;
    const refs = product.messages.flatMap((m) => m.images ?? []).slice(-2);
    const referenceImages = [...refs, ...(view ? [view] : [])];

    const drawing = await withUsageContext(productId, product.name, () =>
      drawFlats({ productId, techPack: product.techPack!, instruction, previous, referenceImages }),
    );
    const front = sanitizeSvg(drawing.front);
    const back = sanitizeSvg(drawing.back);
    if (!front || !back) throw new UserError("Claude's drawing wasn't a valid SVG. Please try again.");
    const result = {
      front: await saveImage(productId, "flat", "image/svg+xml", Buffer.from(front, "utf8")),
      back: await saveImage(productId, "flat", "image/svg+xml", Buffer.from(back, "utf8")),
      notes: drawing.notes,
    };
    await setStep(productId, jobId, "frontback", "done");
    return result;
  } catch (error) {
    throw toStepError(error);
  }
}
drawFrontBackStep.maxRetries = 1;

async function drawGuideStep(productId: string, jobId: string, frontFile: string) {
  "use step";
  try {
    await setStep(productId, jobId, "guide", "running");
    const product = await getProduct(productId);
    const front = await readImage(productId, frontFile);
    if (!product?.techPack || !front) throw new UserError("The front flat is missing.");
    const guide = await withUsageContext(productId, product.name, () =>
      drawMeasurementGuide({ techPack: product.techPack!, frontSvg: front.buffer.toString("utf8") }),
    );
    const svg = sanitizeSvg(guide.svg);
    if (!svg) throw new UserError("Claude's measurement guide wasn't a valid SVG. Please try again.");
    const file = await saveImage(productId, "flat", "image/svg+xml", Buffer.from(svg, "utf8"));
    await setStep(productId, jobId, "guide", "done");
    return file;
  } catch (error) {
    throw toStepError(error);
  }
}
drawGuideStep.maxRetries = 1;

async function saveFlatSetStep(
  productId: string,
  jobId: string,
  fb: { front: string; back: string; notes: string },
  guide: string,
) {
  "use step";
  await setStep(productId, jobId, "save", "running");
  await changeProduct(productId, (product) => {
    product.flats = [
      ...(product.flats ?? []),
      {
        id: randomUUID(),
        front: fb.front,
        back: fb.back,
        measurementGuide: guide,
        technical: null,
        technicalNotes: [],
        note: fb.notes,
        at: new Date().toISOString(),
      },
    ];
  });
}
