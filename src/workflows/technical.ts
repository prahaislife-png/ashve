import { drawTechnicalSketch } from "@/lib/ai";
import { deleteImage, readImage, sanitizeSvg, saveImage } from "@/lib/files";
import { getProduct } from "@/lib/store";
import { changeProduct, UserError } from "@/lib/route";
import { withUsageContext } from "@/lib/usage";
import { setStep } from "@/lib/jobs";
import { completeJob, markFailed, toStepError } from "./shared";

/** Technical sketch (numbered construction callouts) as a background job. */
export async function technicalWorkflow(productId: string, jobId: string) {
  "use workflow";
  try {
    const result = await drawCalloutsStep(productId, jobId);
    await saveTechnicalStep(productId, jobId, result);
    await completeJob(productId, jobId);
  } catch (error) {
    await markFailed(productId, jobId, error instanceof Error ? error.message : String(error));
  }
}

async function drawCalloutsStep(productId: string, jobId: string) {
  "use step";
  try {
    await setStep(productId, jobId, "callouts", "running");
    const product = await getProduct(productId);
    const set = product?.flats?.at(-1);
    if (!product?.techPack || !set) throw new UserError("Draw the flat sketches first.");
    const front = await readImage(productId, set.front);
    if (!front) throw new UserError("The front flat file is missing.");
    const sketch = await withUsageContext(productId, product.name, () =>
      drawTechnicalSketch({ techPack: product.techPack!, frontSvg: front.buffer.toString("utf8") }),
    );
    const svg = sanitizeSvg(sketch.svg);
    if (!svg) throw new UserError("Claude's technical sketch wasn't a valid SVG. Please try again.");
    const file = await saveImage(productId, "flat", "image/svg+xml", Buffer.from(svg, "utf8"));
    await setStep(productId, jobId, "callouts", "done");
    return { setId: set.id, file, callouts: sketch.callouts };
  } catch (error) {
    throw toStepError(error);
  }
}
drawCalloutsStep.maxRetries = 1;

async function saveTechnicalStep(
  productId: string,
  jobId: string,
  r: { setId: string; file: string; callouts: { n: number; title: string; detail: string }[] },
) {
  "use step";
  await setStep(productId, jobId, "save", "running");
  let old: string | null | undefined = null;
  await changeProduct(productId, (product) => {
    const set = product.flats?.find((f) => f.id === r.setId);
    if (!set) return;
    old = set.technical;
    set.technical = r.file;
    set.technicalNotes = r.callouts;
  });
  if (old) await deleteImage(productId, old);
}
