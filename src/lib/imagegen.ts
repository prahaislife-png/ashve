import "server-only";
import { Brand, MockupView, TechPack } from "./schema";

// OpenAI image model. Key from https://platform.openai.com/api-keys
// Override in .env.local with OPENAI_IMAGE_MODEL / OPENAI_IMAGE_QUALITY (low | medium | high).
const MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const QUALITY = process.env.OPENAI_IMAGE_QUALITY || "medium";
const PORTRAIT = "1024x1536";
const API = "https://api.openai.com/v1/images";

export class ImageGenError extends Error {}

type InlineImage = { mime: string; data: Buffer };

const PRODUCT_RENDER =
  "Photorealistic e-commerce product render on a pure white background, invisible ghost mannequin (no person, no hanger), garment centred and fully in frame with even margins, soft shadowless studio lighting.";

const VIEW_PROMPTS: Record<MockupView, string> = {
  "product-front": `${PRODUCT_RENDER} FRONT view, facing the camera straight on.`,
  "product-side": `${PRODUCT_RENDER} SIDE view (left side profile), showing the side silhouette, side seams and depth.`,
  "product-back": `${PRODUCT_RENDER} BACK view, showing the back of the garment straight on.`,
  "flat-front":
    "Professional e-commerce flat-lay photo of the garment, FRONT view, laid perfectly flat and neatly styled on a clean warm off-white background, shot from directly above. Soft, even studio lighting. No model, no hanger, no props.",
  "flat-back":
    "Professional e-commerce flat-lay photo of the garment, BACK view, laid perfectly flat and neatly styled on a clean warm off-white background, shot from directly above. Soft, even studio lighting. No model, no hanger, no props.",
  "on-model":
    "Clean studio e-commerce photo of a woman wearing the garment, full body, standing in a relaxed natural pose against a plain warm light-grey seamless backdrop. Soft diffused lighting. The garment is the focus and fits exactly as described.",
  lifestyle:
    "Editorial lifestyle photo of a woman wearing the garment, relaxing in a calm, sunlit, minimalist home interior with natural textures. Soft morning light, candid, cosy and premium. The garment is clearly visible and fits exactly as described.",
  detail:
    "Macro close-up product photo showing the fabric texture and construction details of the garment (neckline, cuffs, waistband, seams and trims), soft directional studio light.",
};

function garmentDescription(tp: TechPack, colorwayName: string) {
  const colour = tp.colorways.find((c) => c.name === colorwayName) ?? tp.colorways[0];
  const fabrics = tp.fabrics
    .map((f) => `${f.placement}: ${f.composition} ${f.construction}${f.weightGsm ? ` ${f.weightGsm} GSM` : ""}${f.finish && f.finish !== "None" ? `, ${f.finish}` : ""}`)
    .join("; ");
  const trims = tp.trims.map((t) => `${t.item} (${t.description})`).join("; ");
  return [
    `Garment: ${tp.styleName} – ${tp.category}.`,
    `Description: ${tp.description}`,
    `Fit: ${tp.fit}`,
    colour
      ? `Colour: ${colour.name}${colour.pantone ? `, Pantone ${colour.pantone}` : ""}, approximately ${colour.hex}. Match this colour accurately.`
      : "",
    fabrics ? `Fabric: ${fabrics}.` : "",
    trims ? `Trims and details: ${trims}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildMockupPrompt(opts: {
  techPack: TechPack;
  brand: Brand;
  view: MockupView;
  colorway: string;
  note: string;
  hasReferences: boolean;
}) {
  const { techPack, brand, view, colorway, note, hasReferences } = opts;
  return [
    VIEW_PROMPTS[view],
    garmentDescription(techPack, colorway),
    brand.aesthetic ? `Brand look and feel: ${brand.aesthetic}` : "",
    hasReferences
      ? "The attached photos are the designer's reference images: follow their silhouette, proportions and details, but use the colour and fabric described above."
      : "",
    note ? `Extra direction from the designer: ${note}` : "",
    "Photorealistic, accurate garment construction and realistic fabric drape. No text, no watermarks, no visible brand logos.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Same garment from another angle, using the front render as the reference image. */
export function buildViewFromFrontPrompt(view: "product-side" | "product-back", tp: TechPack) {
  return [
    `This image is the FRONT of a garment. Create the ${view === "product-side" ? "SIDE (left profile)" : "BACK"} view of exactly the same garment.`,
    VIEW_PROMPTS[view],
    "Keep the identical colour, fabric, texture, proportions, lengths and details. Show only what would really be visible from this angle.",
    `Back and side details from the spec: ${tp.construction.map((c) => `${c.area}: ${c.method}`).join("; ").slice(0, 1500)}`,
    "No text, no watermarks.",
  ].join("\n\n");
}

export function buildCloseupPrompt(title: string, note: string) {
  return `From this product image, create a macro close-up photo of this detail: ${title}. ${note}\n\nKeep the identical colour, fabric and finish. Fill the frame with the detail, soft directional studio light, white background where any background shows. Photorealistic. No text or watermarks.`;
}

export function buildPrintPrompt(opts: {
  kind: "repeat" | "placement";
  description: string;
  colors: string[];
  aesthetic: string;
}) {
  const palette = opts.colors.length ? `Use only these colours: ${opts.colors.join(", ")}.` : "";
  return opts.kind === "repeat"
    ? `A flat, print-ready SEAMLESS REPEAT textile pattern tile for women's loungewear: ${opts.description}. ${palette} The tile must repeat perfectly on all four edges with no visible seams. Flat 2D artwork, straight-on, no fabric texture, no folds, no shadows, no mockup, no text. ${opts.aesthetic ? `Brand look: ${opts.aesthetic}.` : ""}`
    : `A flat, print-ready PLACEMENT GRAPHIC for women's loungewear: ${opts.description}. ${palette} Centred on a plain white background, crisp clean edges, flat 2D artwork suitable for screen printing or embroidery, no garment, no mockup, no shadows. ${opts.aesthetic ? `Brand look: ${opts.aesthetic}.` : ""}`;
}

export function buildLabelPrompt(opts: {
  slot: "product" | "hangTag";
  brandName: string;
  aesthetic: string;
  care: string[];
  composition: string;
  notes: string;
}) {
  const name = opts.brandName || "BRAND";
  if (opts.slot === "product") {
    return `Flat, straight-on artwork of a soft woven garment label for a women's loungewear brand, shown on a plain light background. Large label with the brand name "${name}" in elegant minimal typography. Next to it a smaller care label with the text: "${opts.composition}" and care lines: ${opts.care.slice(0, 5).map((c) => `"${c}"`).join(", ")}, plus standard laundry care symbols. ${opts.aesthetic ? `Brand look: ${opts.aesthetic}.` : ""} ${opts.notes} Clean, legible text, print-ready design, no hands, no garment.`;
  }
  return `Flat, straight-on artwork of a premium hang tag (front and back side by side) for a women's loungewear brand, shown on a plain light background. Front: brand name "${name}" in elegant minimal typography, with a punched hole and cotton string at the top. Back: space for size, style number, price and a barcode area. ${opts.aesthetic ? `Brand look: ${opts.aesthetic}.` : ""} ${opts.notes} Clean, legible text, print-ready design, no hands.`;
}

export function buildEditPrompt(instruction: string) {
  return `Edit this product photo: ${instruction}\n\nKeep everything else identical: the same garment, colour, fabric, background, lighting and framing. Photorealistic. No text or watermarks.`;
}

/**
 * Make an image. With no input images this is a fresh generation; with input images
 * (reference photos, or a mockup being edited) it uses OpenAI's edit endpoint.
 */
export async function generateImage(
  prompt: string,
  images: InlineImage[],
  size: "1024x1536" | "1024x1024" | "1536x1024" = PORTRAIT,
): Promise<InlineImage> {
  const SIZE = size;
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new ImageGenError(
      "No image key found. Add OPENAI_API_KEY to .env.local and restart the app.",
    );
  }

  let res: Response;
  try {
    if (images.length === 0) {
      res = await fetch(`${API}/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: MODEL,
          prompt,
          size: SIZE,
          quality: QUALITY,
          output_format: "jpeg",
          n: 1,
        }),
      });
    } else {
      const form = new FormData();
      form.append("model", MODEL);
      form.append("prompt", prompt);
      form.append("size", SIZE);
      form.append("quality", QUALITY);
      form.append("output_format", "jpeg");
      images.forEach((img, i) => {
        const ext = img.mime.split("/")[1] ?? "png";
        form.append("image[]", new Blob([new Uint8Array(img.data)], { type: img.mime }), `input-${i}.${ext}`);
      });
      res = await fetch(`${API}/edits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      });
    }
  } catch {
    throw new ImageGenError("Couldn't reach OpenAI's image service. Check the internet connection.");
  }

  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string; code?: string | null; type?: string };
    data?: { b64_json?: string }[];
  } | null;

  if (!res.ok) {
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 401) {
      throw new ImageGenError("The OpenAI API key is invalid. Check OPENAI_API_KEY in .env.local.");
    }
    if (body?.error?.code === "moderation_blocked") {
      throw new ImageGenError("OpenAI's safety filter blocked this image. Try rewording the note.");
    }
    if (res.status === 403 && /verif/i.test(msg)) {
      throw new ImageGenError(
        "OpenAI needs your organization to be verified before using its image model (platform.openai.com → Settings → Organization).",
      );
    }
    if (res.status === 429) {
      throw new ImageGenError("OpenAI image limit reached or no credit left. Check billing at platform.openai.com.");
    }
    throw new ImageGenError(`Image service error: ${msg}`);
  }

  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new ImageGenError("No image came back. Please try again.");
  return { mime: "image/jpeg", data: Buffer.from(b64, "base64") };
}
