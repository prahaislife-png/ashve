import { translateStrings } from "@/lib/ai";
import { getBrand, getProduct } from "@/lib/store";
import { changeProduct, UserError } from "@/lib/route";
import { withUsageContext } from "@/lib/usage";
import { setStep } from "@/lib/jobs";
import { languageOf } from "@/lib/locale";
import { DOC_LABELS, fingerprint, techPackStrings } from "@/lib/translate";
import { completeJob, markFailed, toStepError } from "./shared";

const CHUNK = 60;

/**
 * Translate the tech pack (and the document's headings) into a factory language.
 * The text is split into chunks translated in parallel, then saved as one lookup table.
 */
export async function translateWorkflow(productId: string, jobId: string, lang: string) {
  "use workflow";
  try {
    const { chunks, source } = await prepareStep(productId, jobId);
    const results = await Promise.all(chunks.map((c) => translateChunkStep(productId, lang, c)));
    await saveStep(productId, jobId, lang, source, chunks, results);
    await completeJob(productId, jobId);
  } catch (error) {
    await markFailed(productId, jobId, error instanceof Error ? error.message : String(error));
  }
}

async function prepareStep(productId: string, jobId: string) {
  "use step";
  try {
    await setStep(productId, jobId, "translate", "running");
    const product = await getProduct(productId);
    if (!product?.techPack) throw new UserError("Create the tech pack first.");
    const strings = [...new Set([...DOC_LABELS, ...techPackStrings(product.techPack)])];
    const chunks: string[][] = [];
    for (let i = 0; i < strings.length; i += CHUNK) chunks.push(strings.slice(i, i + CHUNK));
    return { chunks, source: fingerprint(product.techPack) };
  } catch (error) {
    throw toStepError(error);
  }
}
prepareStep.maxRetries = 1;

async function translateChunkStep(productId: string, lang: string, strings: string[]) {
  "use step";
  try {
    const [product, brand] = await Promise.all([getProduct(productId), getBrand()]);
    const language = languageOf(lang);
    const region = [language.region, brand.vendorCountry].filter(Boolean).join(", ");
    return await withUsageContext(productId, product?.name ?? "", () =>
      translateStrings({ strings, language: `${language.name} (${language.native})`, region }),
    );
  } catch (error) {
    throw toStepError(error);
  }
}
translateChunkStep.maxRetries = 1;

async function saveStep(
  productId: string,
  jobId: string,
  lang: string,
  source: string,
  chunks: string[][],
  results: string[][],
) {
  "use step";
  try {
    await setStep(productId, jobId, "translate", "done");
    await setStep(productId, jobId, "save", "running");
    const strings: Record<string, string> = {};
    chunks.forEach((c, i) => c.forEach((en, j) => (strings[en] = results[i][j]?.trim() || en)));
    await changeProduct(productId, (product) => {
      product.translations = { ...(product.translations ?? {}), [lang]: { at: new Date().toISOString(), source, strings } };
    });
    await setStep(productId, jobId, "save", "done");
  } catch (error) {
    throw toStepError(error);
  }
}
saveStep.maxRetries = 1;
